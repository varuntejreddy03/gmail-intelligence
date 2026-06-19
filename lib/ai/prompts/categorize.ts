export const CATEGORIZE_PROMPT = `Classify the following email into exactly ONE category.
Respond ONLY with valid JSON in this exact format:
{"category": "<category>", "confidence": <0.0-1.0>}

Categories: Newsletter, Job/Recruitment, Finance,
Notifications, Personal, Work/Professional

Subject: {subject}
Email Content (first 500 chars): {snippet}

JSON Response:`;
