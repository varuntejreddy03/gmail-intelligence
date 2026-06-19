export const EMAIL_SUMMARY_PROMPT = `You are an email assistant. Summarize the following email
in 2-3 sentences. Be concise and capture the key action
items or main message. Do not add any information not
present in the email.

Email:
{emailContent}

Summary:`;

export const THREAD_SUMMARY_PROMPT = `You are an email assistant. The following is a complete
email thread in chronological order. Summarize the entire
conversation arc in 3-4 sentences - what started it,
what was discussed, and what the current status or
resolution is.

Thread:
{threadContext}

Thread Summary:`;
