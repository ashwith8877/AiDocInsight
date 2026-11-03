import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  loginValidator,
  googleLoginValidator,
  registerValidator,
  validate,
} from '../validators/authValidator.js';

const router = Router();

router.post('/register', registerValidator, validate, authController.register);
router.post('/login', loginValidator, validate, authController.login);
router.post('/google', googleLoginValidator, validate, authController.googleLogin);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

export default router;
