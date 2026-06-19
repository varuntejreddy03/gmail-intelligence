"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Inbox, PenLine, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Inbox", icon: Inbox },
  { href: "/chat", label: "Ask", icon: Bot },
  { href: "/compose", label: "Write", icon: PenLine },
];

/** Provides compact primary navigation on small screens. */
export function MobileHeader(): JSX.Element {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur lg:hidden">
      <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white"><Sparkles className="h-4 w-4" /></Link>
      <nav className="flex items-center gap-1">{links.map((link) => { const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/thread/") : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs", active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500")}><link.icon className="h-3.5 w-3.5" />{link.label}</Link>; })}</nav>
    </header>
  );
}
