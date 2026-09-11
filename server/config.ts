import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: 3000,
  host: '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'tasklens-super-secret-jwt-key-2026',
  mongoUri: process.env.MONGODB_URI || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
  whatsapp: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
  },
};
