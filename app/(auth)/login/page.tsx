import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default async function LoginPage(): Promise<JSX.Element> {
  if (await auth()) redirect("/");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#131318] px-6 selection:bg-[#d0bcff]/30">
      {/* Background mesh */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(at 0% 0%, rgba(109, 59, 215, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(49, 5, 126, 0.2) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(139, 92, 246, 0.05) 0px, transparent 50%)",
        filter: "blur(80px)"
      }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Login Card */}
        <div className="glass-card ai-glow rounded-xl p-8 md:p-10 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d0bcff] to-[#a078ff] flex items-center justify-center shadow-xl shadow-[#d0bcff]/20">
              <span className="material-symbols-outlined text-4xl text-[#340080]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
          </div>

          {/* Header */}
          <h1 className="text-[40px] font-bold tracking-[-0.02em] bg-gradient-to-br from-[#d0bcff] to-[#a078ff] bg-clip-text text-transparent mb-2">
            Aetheric Mail
          </h1>
          <p className="text-sm text-[#cbc3d7] max-w-[240px] mx-auto mb-8">
            The future of intelligent communication.
          </p>

          {/* Google Sign In */}
          <GoogleSignInButton />

          {/* Footer */}
          <footer className="mt-10 flex gap-6">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#494454]">Privacy Policy</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#494454]">Terms of Service</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
