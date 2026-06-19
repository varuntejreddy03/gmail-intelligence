import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@/lib/utils";
import type { EmailCategory, EmailThread } from "@/types";

const categoryColors: Record<EmailCategory, string> = {
  Newsletter: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  "Job/Recruitment": "bg-blue-500/10 text-blue-300 border-blue-500/30",
  Finance: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  Notifications: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  Personal: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  "Work/Professional": "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
};

export function EmailCard({ thread }: { thread: EmailThread }): JSX.Element {
  const sender = thread.participants[0] ?? "Unknown";
  const initials = sender.slice(0, 2).toUpperCase();
  const time = formatDistanceToNowStrict(new Date(thread.lastMessageAt), { addSuffix: true });

  return (
    <Link
      href={`/thread/${encodeURIComponent(thread.id)}`}
      className={cn(
        "p-4 rounded-xl flex items-center gap-4 cursor-pointer group transition-all duration-200",
        !thread.isRead && "border-l-4 border-l-[#d0bcff]"
      )}
      style={{
        background: !thread.isRead ? 'rgba(208,188,255,0.03)' : 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        transform: 'translateX(0)',
        transition: 'transform 200ms ease-out',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateX(4px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateX(0)"; }}
    >
      <div className="shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold",
          !thread.isRead
            ? "bg-[#a078ff]/30 text-[#d0bcff]"
            : "bg-white/[0.06] text-[#cbc3d7]"
        )}>
          {initials}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={cn("text-[15px] truncate", !thread.isRead ? "font-semibold text-[#e4e1e9]" : "text-[#cbc3d7]")}>
            {sender}
          </h3>
          <span className="text-[11px] font-semibold tracking-wide text-[#cbc3d7]/60 shrink-0 ml-3">{time}</span>
        </div>
        <div className="flex items-center gap-3">
          <p className="truncate text-sm text-[#cbc3d7] flex-1">{thread.subject} — {thread.snippet}</p>
          {thread.category && (
            <span className={cn("shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border", categoryColors[thread.category])}>
              {thread.category}
            </span>
          )}
          {thread.summary && (
            <span className="shrink-0 ai-glow bg-[#a078ff]/20 text-[#d0bcff] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-[#d0bcff]/30">
              AI Summary
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
