import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";

import { requireEnv } from "@/lib/env";
import {
  providerUserId,
  updateUserTokens,
  upsertUser,
} from "@/lib/database/queries";
import { encryptToken } from "@/lib/utils/crypto";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
}

interface AppJwt extends JWT {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: "RefreshTokenError";
}

/** Exchanges a Google refresh token for a fresh access token. */
async function refreshGoogleAccessToken(token: {
  userId: string;
  refreshToken: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(`Google token refresh failed: ${payload.error ?? response.statusText}`);
  }
  const expiresAt = Math.floor(Date.now() / 1000) + payload.expires_in;
  const refreshToken = payload.refresh_token ?? token.refreshToken;
  await updateUserTokens(
    token.userId,
    encryptToken(payload.access_token) ?? "",
    expiresAt,
    encryptToken(refreshToken),
  );
  return { accessToken: payload.access_token, refreshToken, expiresAt };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "google" || !user.email) return false;
      const userId = providerUserId(account.providerAccountId);
      await upsertUser({
        id: userId,
        email: user.email,
        name: user.name,
        avatarUrl: user.image,
        accessToken: encryptToken(account.access_token),
        refreshToken: encryptToken(account.refresh_token),
        expiresAt: account.expires_at,
      });
      if (account.access_token) {
        // Sync triggered via SYNC GMAIL button in the UI → Express backend
      }
      return true;
    },
    async jwt({ token, account }) {
      const appToken = token as AppJwt;
      if (account?.provider === "google") {
        appToken.userId = providerUserId(account.providerAccountId);
        appToken.accessToken = account.access_token;
        appToken.refreshToken = account.refresh_token;
        appToken.expiresAt = account.expires_at;
        appToken.error = undefined;
        return appToken;
      }
      if (!appToken.expiresAt || Date.now() < (appToken.expiresAt - 60) * 1000) return appToken;
      if (!appToken.refreshToken || !appToken.userId) {
        appToken.error = "RefreshTokenError";
        return appToken;
      }
      try {
        const refreshed = await refreshGoogleAccessToken({
          userId: appToken.userId,
          refreshToken: appToken.refreshToken,
        });
        appToken.accessToken = refreshed.accessToken;
        appToken.refreshToken = refreshed.refreshToken;
        appToken.expiresAt = refreshed.expiresAt;
        appToken.error = undefined;
      } catch {
        appToken.error = "RefreshTokenError";
      }
      return appToken;
    },
    async session({ session, token }) {
      const appToken = token as AppJwt;
      session.user.id = appToken.userId ?? appToken.sub ?? "";
      session.accessToken = appToken.accessToken;
      session.expiresAt = appToken.expiresAt;
      session.error = appToken.error;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    accessToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}
