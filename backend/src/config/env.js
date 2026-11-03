import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Warning: missing environment variable ${key}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aidocinsight',
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '685951557891-hpmpqc71kohbtgeqo721ktgde0qdpgvu.apps.googleusercontent.com',
  aiApiKey: process.env.GEMINI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 30000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  upload: {
    maxZipBytes: parseInt(process.env.MAX_ZIP_BYTES, 10) || 50 * 1024 * 1024,
    maxExtractedBytes: parseInt(process.env.MAX_EXTRACTED_BYTES, 10) || 200 * 1024 * 1024,
    maxExtractedFiles: parseInt(process.env.MAX_EXTRACTED_FILES, 10) || 5000,
    tempDir: process.env.TEMP_DIR || path.join(backendRoot, 'src', 'temp'),
    uploadsDir: process.env.UPLOADS_DIR || path.join(backendRoot, 'src', 'uploads'),
  },
};

export default env;
