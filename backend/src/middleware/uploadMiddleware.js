import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getZipStoragePath } from '../utils/paths.js';

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(env.upload.tempDir, 'zips'));
  },
  filename(_req, file, cb) {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${randomUUID()}-${safeBase}.zip`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'multipart/x-zip',
  ]);

  if (ext !== '.zip') {
    return cb(ApiError.badRequest('Only .zip files are allowed.'));
  }

  if (file.mimetype && !allowedMimes.has(file.mimetype)) {
    return cb(ApiError.badRequest('Invalid file type. Please upload a ZIP archive.'));
  }

  return cb(null, true);
};

export const uploadZipMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.upload.maxZipBytes,
    files: 1,
  },
}).single('zipFile');

export const handleMulterError = (err, _req, _res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        ApiError.badRequest(
          `ZIP file exceeds the ${Math.round(env.upload.maxZipBytes / (1024 * 1024))}MB size limit.`
        )
      );
    }
    return next(ApiError.badRequest(err.message));
  }

  return next(err);
};

export const removeFileQuietly = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore missing files
  }
};

export { getZipStoragePath };
