import { body, validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';
import { removeFileQuietly } from '../middleware/uploadMiddleware.js';

export const uploadProjectValidator = [
  body('projectName')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('Project name must be between 2 and 120 characters'),
];

export const validateUpload = async (req, _res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file?.path) {
      await removeFileQuietly(req.file.path);
    }

    const errors = result.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(ApiError.badRequest('Validation failed', errors));
  }
  return next();
};
