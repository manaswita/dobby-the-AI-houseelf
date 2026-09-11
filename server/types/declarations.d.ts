declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: { buffer: Buffer }): Promise<ExtractRawTextResult>;
}
