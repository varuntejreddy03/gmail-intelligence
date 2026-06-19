import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "260px 1fr", background: "#0a0a0a", color: "#e5e7eb" }}>
      <div style={{ height: "100vh", position: "sticky", top: 0 }}>
        <Sidebar user={session.user} />
      </div>
      <main style={{ minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <MobileHeader />
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
