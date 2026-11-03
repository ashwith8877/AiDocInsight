import fs from 'fs/promises';
import path from 'path';
import env from '../config/env.js';

export const ensureUploadDirs = async () => {
  await fs.mkdir(env.upload.tempDir, { recursive: true });
  await fs.mkdir(env.upload.uploadsDir, { recursive: true });
  await fs.mkdir(path.join(env.upload.tempDir, 'zips'), { recursive: true });
  await fs.mkdir(path.join(env.upload.tempDir, 'extracted'), { recursive: true });
};

export const getZipStoragePath = (filename) =>
  path.join(env.upload.tempDir, 'zips', filename);

export const getExtractDir = (projectId) =>
  path.join(env.upload.tempDir, 'extracted', String(projectId));
