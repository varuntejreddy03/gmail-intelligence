import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";
const SECRET = process.env.BACKEND_INTERNAL_SECRET || "";

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const path = `/v1/${params.path.join("/")}`;
  const url = `${BACKEND}${path}${request.nextUrl.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-secret": SECRET,
    "x-user-id": session.user.id,
  };
  if (session.accessToken) headers["x-access-token"] = session.accessToken;

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? await request.text()
    : undefined;

  try {
    const res = await fetch(url, { method: request.method, headers, body });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
