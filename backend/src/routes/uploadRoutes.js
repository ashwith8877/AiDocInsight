import { Router } from 'express';
import * as uploadController from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  handleMulterError,
  uploadZipMiddleware,
} from '../middleware/uploadMiddleware.js';
import {
  uploadProjectValidator,
  validateUpload,
} from '../validators/uploadValidator.js';

const router = Router();

router.use(protect);

router.post(
  '/',
  uploadZipMiddleware,
  handleMulterError,
  uploadProjectValidator,
  validateUpload,
  uploadController.uploadProject
);

router.get('/', uploadController.listProjects);
router.get('/:id/report', uploadController.downloadProjectReport);
router.get('/:id/analysis', uploadController.getProjectAnalysis);
router.get('/:id', uploadController.getProject);

export default router;
