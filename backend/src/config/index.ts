import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  env: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  backendUrl: optionalEnv('BACKEND_URL', 'http://localhost:5000'),

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '15m'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  slotHold: {
    durationMinutes: parseInt(optionalEnv('SLOT_HOLD_DURATION_MINUTES', '5'), 10),
  },

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  email: {
    host: optionalEnv('SMTP_HOST', 'smtp.ethereal.email'),
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    secure: optionalEnv('SMTP_SECURE', 'false') === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || optionalEnv('EMAIL_FROM', 'CareFlow <noreply@healthcare.app>'),
  },

  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
    baseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1',
    timeoutMs: parseInt(optionalEnv('LLM_TIMEOUT_MS', '20000'), 10),
    temperature: parseFloat(optionalEnv('LLM_TEMPERATURE', '0.3')),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: optionalEnv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/calendar/callback'),
  },
} as const;

export type Config = typeof config;
