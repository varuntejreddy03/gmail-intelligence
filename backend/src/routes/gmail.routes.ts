import { Router } from "express";
import { gmailController } from "../controllers/gmail.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const gmailRoutes = Router();

gmailRoutes.post("/sync", asyncHandler((req, res) => gmailController.sync(req, res)));
gmailRoutes.get("/messages", asyncHandler((req, res) => gmailController.listMessages(req, res)));
gmailRoutes.get("/thread/:id", asyncHandler((req, res) => gmailController.getThread(req, res)));
gmailRoutes.post("/send", asyncHandler((req, res) => gmailController.send(req, res)));
