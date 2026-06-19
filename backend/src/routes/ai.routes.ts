import { Router } from "express";
import { aiController } from "../controllers/ai.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const aiRoutes = Router();

aiRoutes.post("/chat", asyncHandler((req, res) => aiController.chat(req, res)));
aiRoutes.post("/summarize", asyncHandler((req, res) => aiController.summarize(req, res)));
aiRoutes.post("/compose", asyncHandler((req, res) => aiController.compose(req, res)));
aiRoutes.post("/categorize", asyncHandler((req, res) => aiController.categorize(req, res)));
aiRoutes.post("/reprocess", asyncHandler((req, res) => aiController.reprocess(req, res)));
