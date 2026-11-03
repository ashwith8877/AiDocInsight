import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import env from '../config/env.js';
import ApiError from './ApiError.js';

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
]);

const isIgnoredEntry = (entryName) => {
  const parts = entryName.split(/[/\\]/).filter(Boolean);
  return parts.some((part) => IGNORED_DIR_NAMES.has(part));
};

const assertSafeZipEntry = (entryName, extractRoot) => {
  const normalized = entryName.replace(/\\/g, '/');

  if (
    normalized.startsWith('/') ||
    normalized.startsWith('\\') ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.includes('\0')
  ) {
    throw ApiError.badRequest('ZIP contains an unsafe absolute path.');
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw ApiError.badRequest('ZIP contains a path traversal attempt.');
  }

  const destination = path.resolve(extractRoot, normalized);
  const rootWithSep = extractRoot.endsWith(path.sep)
    ? extractRoot
    : `${extractRoot}${path.sep}`;

  if (destination !== extractRoot && !destination.startsWith(rootWithSep)) {
    throw ApiError.badRequest('ZIP entry resolves outside the extraction directory.');
  }

  return destination;
};

/**
 * Securely extract a ZIP into extractRoot.
 * Skips ignored folders, enforces file count and uncompressed size limits.
 */
export const extractZipSecurely = async (zipPath, extractRoot) => {
  let zip;

  try {
    zip = new AdmZip(zipPath);
  } catch {
    throw ApiError.badRequest('Invalid or corrupted ZIP file.');
  }

  const entries = zip.getEntries();
  if (!entries || entries.length === 0) {
    throw ApiError.badRequest('ZIP file is empty or unreadable.');
  }

  await fs.mkdir(extractRoot, { recursive: true });

  let extractedFiles = 0;
  let extractedBytes = 0;

  for (const entry of entries) {
    const entryName = entry.entryName;

    if (!entryName || entryName.endsWith('/')) {
      continue;
    }

    if (isIgnoredEntry(entryName)) {
      continue;
    }

    const destination = assertSafeZipEntry(entryName, extractRoot);
    const uncompressedSize = entry.header?.size ?? 0;

    if (uncompressedSize < 0) {
      throw ApiError.badRequest('ZIP contains an invalid entry size.');
    }

    extractedBytes += uncompressedSize;
    if (extractedBytes > env.upload.maxExtractedBytes) {
      throw ApiError.badRequest(
        `Extracted content exceeds the ${Math.round(env.upload.maxExtractedBytes / (1024 * 1024))}MB limit.`
      );
    }

    extractedFiles += 1;
    if (extractedFiles > env.upload.maxExtractedFiles) {
      throw ApiError.badRequest(
        `ZIP exceeds the maximum of ${env.upload.maxExtractedFiles} extractable files.`
      );
    }

    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      const data = entry.getData();
      await fs.writeFile(destination, data);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.badRequest('Failed to extract ZIP contents. The archive may be corrupted.');
    }
  }

  if (extractedFiles === 0) {
    throw ApiError.badRequest(
      'No usable project files found after filtering ignored paths (node_modules, .git, dist, build, coverage).'
    );
  }

  return {
    fileCount: extractedFiles,
    extractedSizeBytes: extractedBytes,
  };
};
