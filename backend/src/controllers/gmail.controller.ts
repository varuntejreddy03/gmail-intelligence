import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { gmailService } from "../services/gmail.service";

export class GmailController {
  async sync(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.accessToken;
    if (!accessToken) return res.status(400).json({ error: "No access token provided" });

    const result = await gmailService.startSync(req.userId!, accessToken);
    res.status(202).json(result);
  }

  async listMessages(req: AuthenticatedRequest, res: Response) {
    const result = await gmailService.listThreads(req.userId!, {
      category: (req.query.category as string) || undefined,
      search: (req.query.search as string) || undefined,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 25),
    });
    res.json(result);
  }

  async getThread(req: AuthenticatedRequest, res: Response) {
    const thread = await gmailService.getThread(req.userId!, req.params.id);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    res.json(thread);
  }

  async send(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.accessToken;
    if (!accessToken) return res.status(400).json({ error: "No access token" });

    const { to, subject, body, inReplyTo, references, threadId } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: "to, subject, and body required" });

    const result = await gmailService.sendEmail(accessToken, { to, subject, body, inReplyTo, references, threadId });
    res.json(result);
  }
}

export const gmailController = new GmailController();
