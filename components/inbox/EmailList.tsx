"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CategoryFilter } from "@/components/inbox/CategoryFilter";
import { EmailCard } from "@/components/inbox/EmailCard";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { EmailThread, PaginatedResult } from "@/types";

export function EmailList(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<PaginatedResult<EmailThread> | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const category = searchParams.get("category") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (category) params.set("category", category);
    if (query.trim()) params.set("search", query.trim());
    try {
      const response = await api(`/v1/gmail/messages?${params.toString()}`);
      if (!response.ok) throw new Error("Unable to load inbox");
      setResult((await response.json()) as PaginatedResult<EmailThread>);
    } finally {
      setLoading(false);
    }
  }, [category, page, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  async function runCategorize(): Promise<void> {
    setProcessing(true);
    let total = 0;
    try {
      for (let i = 0; i < 20; i++) {
        const res = await api("/v1/ai/reprocess", { method: "POST" });
        if (!res.ok) break;
        const data = await res.json();
        total += data.categorized + data.embedded;
        setProgress(`${total} processed`);
        if (data.categorized === 0 && data.embedded === 0) break;
      }
      await load();
    } finally {
      setProcessing(false);
      setProgress("");
    }
  }

  function goToPage(nextPage: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPage));
    router.push(`/?${next.toString()}`);
  }

  return (
    <div className="px-8 pb-10">
      {/* Header */}
      <div className="flex items-end justify-between py-8">
        <div>
          <h2 className="text-[30px] font-semibold tracking-[-0.01em] text-[#e4e1e9]">Inbox</h2>
          <p className="text-sm text-[#cbc3d7] mt-1">
            {result ? `You have ${result.total} conversations managed by AI.` : "Loading..."}
          </p>
        </div>
        <button
          className="group relative flex items-center gap-2 bg-[#d0bcff]/10 border border-[#d0bcff]/20 text-[#d0bcff] px-6 py-3 rounded-xl overflow-hidden hover:bg-[#d0bcff]/20 transition-all duration-300 disabled:opacity-50"
          onClick={() => void runCategorize()}
          disabled={processing}
        >
          {processing && (
            <div className="absolute left-0 bottom-0 h-1 bg-[#d0bcff] animate-pulse w-full" />
          )}
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="text-xs font-bold uppercase tracking-wide">
            {processing ? progress || "Categorizing..." : "AI Categorize"}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-2xl">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#cbc3d7]">search</span>
        <input
          className="w-full bg-black/20 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-[#e4e1e9] placeholder:text-[#cbc3d7]/40 focus:outline-none focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] transition-all"
          placeholder="Search mail with Aether Intelligence..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Category Pills */}
      <div className="mb-8">
        <CategoryFilter />
      </div>

      {/* Email List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-xl flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32 bg-white/[0.06]" />
                <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
              </div>
            </div>
          ))
        ) : result?.data.length ? (
          result.data.map((thread) => <EmailCard key={thread.id} thread={thread} />)
        ) : (
          <div className="glass-card rounded-xl flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-[#cbc3d7]/40 mb-4">inbox</span>
            <h3 className="font-medium text-[#e4e1e9]">No conversations found</h3>
            <p className="mt-2 text-sm text-[#cbc3d7]/60">Sync Gmail or adjust your filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-between border-t border-white/[0.06] pt-6">
          <span className="text-[13px] text-[#cbc3d7]">Page {result.page} of {result.totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              className="p-2 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors"
              disabled={page >= result.totalPages}
              onClick={() => goToPage(page + 1)}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
