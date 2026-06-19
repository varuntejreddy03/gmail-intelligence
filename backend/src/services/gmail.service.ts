import { initialSync, incrementalSync } from "@/lib/gmail/sync";
import { getGmailClient, sendEmail } from "@/lib/gmail/client";
import { getThreadById, listThreads, getSyncState } from "@/lib/database/queries";
import type { EmailThread, PaginatedResult, SendEmailParams } from "@/types";

export class GmailService {
  async startSync(userId: string, accessToken: string): Promise<{ status: string; type: string }> {
    const state = await getSyncState(userId);
    const type = state?.lastFullSyncAt ? "incremental-sync" : "full-sync";

    // Run async — don't block the response
    if (type === "full-sync") {
      initialSync(userId, accessToken).catch((err) => console.error("[GmailService] Sync error:", err));
    } else {
      incrementalSync(userId, accessToken).catch((err) => console.error("[GmailService] Sync error:", err));
    }

    return { status: "started", type };
  }

  async listThreads(userId: string, options: { category?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResult<EmailThread>> {
    return listThreads({ userId, ...options });
  }

  async getThread(userId: string, threadId: string): Promise<EmailThread | null> {
    return getThreadById(userId, threadId);
  }

  async sendEmail(accessToken: string, params: SendEmailParams) {
    const client = getGmailClient(accessToken);
    return sendEmail(client, params);
  }
}

export const gmailService = new GmailService();
