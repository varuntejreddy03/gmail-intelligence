"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { EMAIL_CATEGORIES } from "@/types";

export function CategoryFilter(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category") ?? "All";
  const categories = ["All", ...EMAIL_CATEGORIES];

  return (
    <div className="flex items-center gap-3">
      {categories.map((category) => (
        <button
          key={category}
          className={cn(
            "px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95",
            active === category
              ? "bg-[#d0bcff] text-[#3c0091]"
              : "bg-white/[0.05] border border-white/10 text-[#cbc3d7] hover:bg-white/10"
          )}
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            if (category === "All") next.delete("category");
            else next.set("category", category);
            next.delete("page");
            router.push(`${pathname}?${next.toString()}`);
          }}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
