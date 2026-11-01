import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Gate every /admin route except the login page. Server actions re-check the
// session themselves, so this is a convenience redirect, not the only guard.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
