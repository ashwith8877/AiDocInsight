import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

export const chatValidator = [
  body('projectId')
    .trim()
    .notEmpty()
    .withMessage('Project ID is required')
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage('Project ID must be a valid MongoDB ObjectId'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 2000 })
    .withMessage('Message must be 2000 characters or fewer'),
];

export const validateChat = (req, _res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));
    return next(ApiError.badRequest('Validation failed', errors));
  }
  return next();
};
