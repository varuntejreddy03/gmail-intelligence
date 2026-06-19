export const EMAIL_CATEGORIES = [
  "Newsletter",
  "Job/Recruitment",
  "Finance",
  "Notifications",
  "Personal",
  "Work/Professional",
] as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];
