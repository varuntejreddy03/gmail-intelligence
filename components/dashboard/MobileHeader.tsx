"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inbox", icon: "inbox" },
  { href: "/chat", label: "Ask AI", icon: "auto_awesome" },
  { href: "/compose", label: "Compose", icon: "edit" },
];

export function MobileHeader(): JSX.Element {
  const pathname = usePathname();
  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 lg:hidden" style={{ background: '#0f0f0f', borderColor: '#1f1f1f' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Aetheric Mail</span>
        <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Email</span>
      </header>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around lg:hidden" style={{ height: 60, background: '#0f0f0f', borderTop: '1px solid #1f1f1f' }}>
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/thread/") : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 16px', borderRadius: 12, textDecoration: 'none',
                color: active ? '#a78bfa' : '#6b7280',
                background: active ? 'rgba(124,58,237,0.1)' : 'transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22, ...(active ? { fontVariationSettings: "'FILL' 1" } : {}) }}>{link.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500 }}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
