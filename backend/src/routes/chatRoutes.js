import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import * as chatController from '../controllers/chatController.js';
import { chatValidator, validateChat } from '../validators/chatValidator.js';

const router = Router();

router.use(protect);
router.post('/', chatValidator, validateChat, chatController.askProjectQuestion);

export default router;
