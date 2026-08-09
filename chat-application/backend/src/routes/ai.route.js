import express from 'express';
import { uploadDocument, queryRAG } from '../ai/aiController.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protectRoute);
router.post("/upload-doc", uploadDocument);
router.post("/query", queryRAG);

export default router;
