"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navigation = [
  { href: "/", label: "Inbox", icon: "inbox" },
  { href: "/chat", label: "Ask AI", icon: "auto_awesome" },
  { href: "/compose", label: "Compose", icon: "edit" },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function Sidebar({ user }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const initials = (user.name ?? user.email ?? "U").slice(0, 2).toUpperCase();

  async function syncNow(): Promise<void> {
    setSyncing(true);
    try {
      const response = await api("/v1/gmail/sync", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to queue sync");
      toast.success("Sync started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue sync");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <aside style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#0f0f0f", borderRight: "1px solid #1f1f1f", padding: "32px 16px" }}>
      {/* Brand */}
      <div style={{ padding: "0 12px", marginBottom: 40 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Aetheric Mail</h1>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "#a78bfa", textTransform: "uppercase", marginTop: 4 }}>AI-Powered Email</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/thread/") : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, fontSize: 14, textDecoration: "none", transition: "all 200ms",
                background: active ? "#1a1a2e" : "transparent",
                color: active ? "#fff" : "#6b7280",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: active ? "#a78bfa" : "#6b7280", ...(active ? { fontVariationSettings: "'FILL' 1" } : {}) }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div>
        <button
          onClick={() => void syncNow()}
          disabled={syncing}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(to right, #7c3aed, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.7 : 1, transition: "all 200ms", marginBottom: 16 }}
        >
          {syncing ? "Syncing..." : "SYNC GMAIL"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", borderTop: "1px solid #1f1f1f" }}>
          <Avatar className="h-9 w-9" style={{ border: "none" }}>
            <AvatarImage src={user.image ?? undefined} alt="" />
            <AvatarFallback style={{ background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 700, border: "none" }}>{initials}</AvatarFallback>
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name ?? "User"}</p>
            <p style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
          </div>
          <button onClick={() => void signOut({ callbackUrl: "/login" })} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
