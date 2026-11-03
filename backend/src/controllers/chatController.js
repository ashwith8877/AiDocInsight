import * as chatService from '../services/chatService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const askProjectQuestion = asyncHandler(async (req, res) => {
  const result = await chatService.answerProjectQuestion({
    userId: req.user._id,
    projectId: req.body.projectId,
    message: req.body.message,
  });

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      projectId: result.projectId,
      response: result.message,
    },
  });
});
