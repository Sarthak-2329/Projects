import express from 'express';
import {
  createGroup,
  getUserGroups,
  getGroupMessages,
  sendGroupMessage,
  leaveGroup,
} from '../controllers/conversation.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';
import { arcjetProtection } from '../middleware/arcjet.middleware.js';

const router = express.Router();

router.use(arcjetProtection);
router.use(protectRoute);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', sendGroupMessage);
router.post('/:id/leave', leaveGroup);

export default router;
