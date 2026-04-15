import { NextRequest, NextResponse } from "next/server";

const USERNAME = process.env.DASHBOARD_USER ?? "admin";
const PASSWORD = process.env.DASHBOARD_PASS ?? "";

export function middleware(req: NextRequest) {
  if (!PASSWORD) {
    // No password configured — block all access to prevent an open dashboard
    return new NextResponse("Dashboard is not configured. Set DASHBOARD_USER and DASHBOARD_PASS environment variables.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");

  if (scheme === "Basic" && encoded) {
    try {
      const [user, pass] = atob(encoded).split(":");
      if (user === USERNAME && pass === PASSWORD) {
        return NextResponse.next();
      }
    } catch {
      // Invalid base64 — fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="OpenClaw Dashboard"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
