import { Router } from 'express';
import authRoutes from './authRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import chatRoutes from './chatRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'AiDocInsight API is running' });
});

router.use('/auth', authRoutes);
router.use('/uploads', uploadRoutes);
router.use('/chat', chatRoutes);

export default router;
