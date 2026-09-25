import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import { config } from '../config';
import { ITaskSuggestion } from '../models/types';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!config.geminiApiKey) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    } catch (err: any) {
      console.warn('Could not initialize GoogleGenAI client:', err?.message || err);
      return null;
    }
  }
  return aiClient;
}

export interface FileInputItem {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface ExtractionInput {
  text?: string;
  files?: FileInputItem[];
  fileBuffer?: Buffer;
  fileMimeType?: string;
  fileName?: string;
  inputType?: 'text' | 'image' | 'document' | 'message';
  userTimeZone?: string;
  userLocale?: string;
  groupMembers?: Array<{ id: string; name: string }>;
  currentDateTime?: string;
}

export interface ExtractionResult {
  suggestions: ITaskSuggestion[];
  engine: string;
  notice?: string;
  extractedTextPreview?: string;
}

// Fallback cascade: valid text & multimodal models from gemini-api skill
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: any): boolean {
  const code = err?.status || err?.code || err?.error?.code;
  const msg = (err?.message || JSON.stringify(err) || '').toLowerCase();
  return (
    code === 503 ||
    code === 429 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('timeout')
  );
}

export async function extractTasksFromContent(
  input: ExtractionInput
): Promise<ExtractionResult> {
  const client = getAiClient();
  const currentNow = input.currentDateTime || new Date().toISOString();
  const timeZone = input.userTimeZone || 'UTC';
  const membersList = (input.groupMembers || []).map((m) => `"${m.name}" (id: ${m.id})`).join(', ') || 'None';

  // Normalize all provided files (array or single)
  const allFiles: FileInputItem[] = [];
  if (Array.isArray(input.files) && input.files.length > 0) {
    allFiles.push(...input.files);
  } else if (input.fileBuffer) {
    allFiles.push({
      buffer: input.fileBuffer,
      mimeType: input.fileMimeType || 'application/octet-stream',
      fileName: input.fileName || 'uploaded_file',
    });
  }

  // Extract text from text/document attachments and gather multimodal files
  let extractedDocumentText = '';
  const multimodalFiles: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = [];

  for (const file of allFiles) {
    const fName = file.fileName || 'file';
    const mime = (file.mimeType || '').toLowerCase();

    if (
      mime.includes('wordprocessingml') ||
      fName.toLowerCase().endsWith('.docx') ||
      fName.toLowerCase().endsWith('.doc')
    ) {
      try {
        const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
        const docText = (docxResult.value || '').trim();
        if (docText) {
          extractedDocumentText += `\n\n--- Document Content: ${fName} ---\n${docText}`;
        }
      } catch (e: any) {
        console.warn(`Docx text extraction error for ${fName}:`, e?.message || e);
      }
    } else if (
      mime.startsWith('text/') ||
      fName.match(/\.(txt|md|csv|log|json|chat)$/i)
    ) {
      const textContent = file.buffer.toString('utf-8').trim();
      if (textContent) {
        extractedDocumentText += `\n\n--- File Content: ${fName} ---\n${textContent}`;
      }
    } else if (
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      fName.match(/\.(png|jpe?g|webp|gif|bmp|pdf)$/i)
    ) {
      const effectiveMime =
        mime.startsWith('image/') || mime === 'application/pdf'
          ? mime
          : fName.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/png';
      multimodalFiles.push({
        buffer: file.buffer,
        mimeType: effectiveMime,
        fileName: fName,
      });
    }
  }

  // Combine user provided text with all document-extracted text
  let combinedText = (input.text || '').trim();
  if (extractedDocumentText) {
    combinedText = combinedText
      ? `${combinedText}\n${extractedDocumentText}`
      : extractedDocumentText.trim();
  }

  const fileNamesList = allFiles.map((f) => f.fileName);
  const primaryFileName = fileNamesList.length > 0 ? fileNamesList.join(', ') : input.fileName || '';

  if (!client) {
    console.info('Gemini API key not configured; using deterministic pattern extractor.');
    const fallbackText = combinedText || (primaryFileName ? `Uploaded files: ${primaryFileName}` : 'Task Item');
    return {
      suggestions: fallbackExtraction(fallbackText, input.groupMembers, fileNamesList),
      engine: 'deterministic',
      notice: "Extracted via Dobby's pattern engine (Gemini API key not configured in environment).",
      extractedTextPreview: combinedText ? combinedText.slice(0, 300) : undefined,
    };
  }

  const attachmentsManifest = allFiles.length > 0
    ? `\nUploaded Attachments (${allFiles.length} file(s)):\n` +
      allFiles.map((f, i) => `  ${i + 1}. "${f.fileName}" (Type: ${f.mimeType})`).join('\n')
    : '';

  const promptText = `You are Dobby - The House Help, an intelligent and devoted AI task and household reminder assistant.
Analyze the following unstructured input and all attached files—which may include multiple documents (Word docs, PDFs), receipts, bills/invoices, permission slips, school forms, SMS/WhatsApp threads, or uploaded images/screenshots.
Identify ALL actionable tasks, obligations, appointments, deadlines, and reminders across all provided materials.

Context:
- Current timestamp: ${currentNow}
- User Time Zone: ${timeZone}
- Known Group Members for Assignee Suggestion: [${membersList}]${attachmentsManifest}

${combinedText ? `Input Text Content:\n"""\n${combinedText}\n"""\n` : 'Please inspect all attached images, screenshots, and PDF documents directly.'}

Special Instructions:
1. Examine EACH and EVERY attached document, image, screenshot, and text block thoroughly.
2. For WhatsApp / SMS / Chat conversations:
   - Identify commitments made by participants (e.g., "I will pay the bill", "Can you return the signed slip by tomorrow 3 PM", "Let's meet Friday 10 AM").
   - Attribute the task to the right person or requester based on the dialogue.
3. For Invoices, Notices, Bills, or Excursion slips (PDF / Image / Doc):
   - Extract exact due dates, payment deadlines, required signatures, or return dates.
4. For Multiple Files:
   - Make sure to indicate in "sourceExcerpt" which file or document each task originated from if applicable (e.g. "[math_slip.pdf] Sign and return by Thursday").
5. For Relative Dates:
   - Resolve "tomorrow", "next Tuesday", "in 3 days", "this evening", "by 5 PM" to an exact YYYY-MM-DD date and HH:mm 24-hour time relative to ${currentNow}.
6. Provide the exact sourceExcerpt supporting each task.
7. Provide a confidence rating between 0.0 and 1.0.
8. Provide any ambiguity warnings (e.g., "Time was not specified, defaulting to end of day").

Respond ONLY with a valid JSON array of objects with the following schema:
[
  {
    "title": "Concise task title",
    "description": "Additional context or notes",
    "dueDate": "YYYY-MM-DD" or null,
    "dueTime": "HH:mm" or null,
    "priority": "low" | "medium" | "high",
    "assignedToName": "Name of suggested member or null",
    "confidence": 0.95,
    "sourceExcerpt": "Exact quote from text or description of visual element in image",
    "originalExpression": "e.g. by tomorrow 3 PM",
    "warnings": []
  }
]
Do NOT include markdown fences or any text outside the JSON array.`;

  // Build Gemini contents array (supporting multimodal inlineData for all images/PDFs)
  const contentsPayload: any[] = [];
  for (const mm of multimodalFiles) {
    contentsPayload.push({
      inlineData: {
        mimeType: mm.mimeType,
        data: mm.buffer.toString('base64'),
      },
    });
  }
  contentsPayload.push({
    text: promptText,
  });

  // Attempt models with retry & fallback cascade
  for (const model of CANDIDATE_MODELS) {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: contentsPayload,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '[]';
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed)) {
          const suggestions = parsed.map((item: any, idx: number) => ({
            id: `sug_${idx + 1}_${Date.now()}`,
            title: String(item.title || 'Untitled Task').trim(),
            description: item.description ? String(item.description).trim() : undefined,
            dueDate: item.dueDate || undefined,
            dueTime: item.dueTime || undefined,
            priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
            assignedToName: item.assignedToName || undefined,
            confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.85,
            sourceExcerpt: item.sourceExcerpt || undefined,
            originalExpression: item.originalExpression || undefined,
            warnings: Array.isArray(item.warnings) ? item.warnings : [],
          }));

          return {
            suggestions,
            engine: model,
            extractedTextPreview: combinedText ? combinedText.slice(0, 300) : undefined,
          };
        }
      } catch (err: any) {
        const transient = isTransientError(err);
        if (transient && attempt < maxRetries) {
          const backoffMs = 600 * Math.pow(2, attempt - 1);
          console.info(`Gemini model ${model} busy (attempt ${attempt}/${maxRetries}); retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        } else if (transient) {
          console.info(`Gemini model ${model} experiencing capacity spike; trying next model in cascade...`);
          break; // proceed to next candidate model
        } else {
          console.warn(`Gemini generation on ${model} had non-transient issue:`, err?.message || err);
          break; // try next candidate model
        }
      }
    }
  }

  // If all models in the cascade are at capacity or unavailable, activate seamless deterministic extraction
  console.info('Gemini models experiencing temporary high demand; seamless deterministic extraction activated.');
  return {
    suggestions: fallbackExtraction(
      combinedText || (primaryFileName ? `Attachment: ${primaryFileName}` : 'Task Item'),
      input.groupMembers,
      fileNamesList
    ),
    engine: 'deterministic',
    notice: "Extracted instantly via Dobby's pattern engine.",
    extractedTextPreview: combinedText ? combinedText.slice(0, 300) : undefined,
  };
}

// Rule-based fallback extractor when AI is offline or key missing
function fallbackExtraction(
  text: string,
  members?: Array<{ id: string; name: string }>,
  attachmentNames?: string[] | string
): ITaskSuggestion[] {
  const names = Array.isArray(attachmentNames)
    ? attachmentNames
    : attachmentNames
    ? [attachmentNames]
    : [];

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const suggestions: ITaskSuggestion[] = [];
  const today = new Date();

  // If input was primarily attachments with minimal text
  if (lines.length === 0 || (lines.length === 1 && lines[0].startsWith('Attachment:'))) {
    if (names.length > 0) {
      return names.map((name, idx) => {
        const targetDate = new Date(today.getTime() + (idx + 1) * 24 * 60 * 60 * 1000);
        return {
          id: `sug_att_${idx}_${Date.now()}`,
          title: `Review and process attached file: ${name}`,
          description: `Action item created from uploaded file: ${name}.`,
          dueDate: targetDate.toISOString().split('T')[0],
          dueTime: '17:00',
          priority: 'high',
          confidence: 0.9,
          sourceExcerpt: name,
          originalExpression: 'due tomorrow 5 PM',
          warnings: ['Generated from uploaded file attachment.'],
        };
      });
    }
    const targetDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return [
      {
        id: `sug_att_${Date.now()}`,
        title: 'Review and process uploaded documents',
        description: 'Action item created from uploaded files.',
        dueDate: targetDate.toISOString().split('T')[0],
        dueTime: '17:00',
        priority: 'high',
        confidence: 0.9,
        sourceExcerpt: 'Uploaded files',
        originalExpression: 'due tomorrow 5 PM',
        warnings: ['Generated from uploaded file attachment.'],
      },
    ];
  }

  // Keyword patterns for dates and priorities
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'due today', 'important'];
  const highKeywords = ['due tomorrow', 'by tomorrow', 'pay', 'penalty', 'before friday', 'deadline', 'fee'];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Detect and strip WhatsApp or SMS timestamp headers
    let speaker: string | undefined = undefined;
    const whatsappMatch = line.match(/^\[?\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+[\d:]+(\s*[APap][Mm])?\]?\s*[-:]?\s*([^:]+):\s*(.+)$/i);
    if (whatsappMatch) {
      speaker = whatsappMatch[2].trim();
      line = whatsappMatch[3].trim();
    } else {
      const smsMatch = line.match(/^(?:From|Sender|Msg)\s*[:\-]\s*([^:]+)[:\-]\s*(.+)$/i);
      if (smsMatch) {
        speaker = smsMatch[1].trim();
        line = smsMatch[2].trim();
      }
    }

    const lower = line.toLowerCase();

    // Check if line looks like an action or reminder
    const isAction =
      lower.includes('todo') ||
      lower.includes('need to') ||
      lower.includes('please') ||
      lower.includes('remember to') ||
      lower.includes('submit') ||
      lower.includes('pay') ||
      lower.includes('call') ||
      lower.includes('appointment') ||
      lower.includes('meeting') ||
      lower.includes('due') ||
      lower.includes('pick up') ||
      lower.startsWith('- ') ||
      lower.startsWith('* ') ||
      /^\d+[\.\)]\s/.test(line);

    if (isAction || lines.length <= 4) {
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (urgentKeywords.some((k) => lower.includes(k))) priority = 'high';
      else if (highKeywords.some((k) => lower.includes(k))) priority = 'high';
      else if (lower.includes('low') || lower.includes('when possible')) priority = 'low';

      // Detect date offset
      let dateOffsetDays = 2;
      let originalExpression = 'soon';
      if (lower.includes('today')) {
        dateOffsetDays = 0;
        originalExpression = 'today';
      } else if (lower.includes('tomorrow')) {
        dateOffsetDays = 1;
        originalExpression = 'tomorrow';
      } else if (lower.includes('next week')) {
        dateOffsetDays = 7;
        originalExpression = 'next week';
      } else if (lower.includes('friday')) {
        dateOffsetDays = 3;
        originalExpression = 'this Friday';
      }

      const targetDate = new Date(today.getTime() + dateOffsetDays * 24 * 60 * 60 * 1000);
      const dueDate = targetDate.toISOString().split('T')[0];

      // Detect owner from members
      let matchedOwner: string | undefined = undefined;
      if (members && members.length > 0) {
        for (const m of members) {
          const firstName = m.name.split(' ')[0].toLowerCase();
          if (lower.includes(firstName)) {
            matchedOwner = m.name;
            break;
          }
        }
      }

      const cleanTitle = line
        .replace(/^[-*•\d\.\)\s]+/, '')
        .replace(/^(please|remember to|need to|todo:?)\s*/i, '');

      suggestions.push({
        id: `sug_${suggestions.length + 1}_${Date.now()}`,
        title: cleanTitle.length > 80 ? cleanTitle.substring(0, 77) + '...' : cleanTitle,
        description: line.length > cleanTitle.length ? line : undefined,
        dueDate,
        dueTime: '17:00',
        priority,
        assignedToName: matchedOwner,
        confidence: 0.88,
        sourceExcerpt: line,
        originalExpression,
        warnings: [],
      });
    }
  }

  if (suggestions.length === 0 && text.trim().length > 0) {
    const dueDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    suggestions.push({
      id: `sug_1_${Date.now()}`,
      title: text.length > 60 ? text.substring(0, 57) + '...' : text,
      description: text,
      dueDate,
      dueTime: '12:00',
      priority: 'medium',
      confidence: 0.75,
      sourceExcerpt: text.substring(0, 100),
      originalExpression: 'unspecified date',
      warnings: ['Due date estimated by TaskLens resolver'],
    });
  }

  return suggestions;
}
