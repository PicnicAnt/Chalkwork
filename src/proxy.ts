import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, accessCodeRequired, isProofValid } from "./lib/access-guard";

// The front door of the site. With an access code set, a device that hasn't given it is sent to the page that asks
// for it, whatever it was after. What a browser needs to load that page (and the app's icons and manifest) stays open.
const OPEN = [/^\/access(\/|$)/, /^\/_next\//, /^\/favicon\.ico$/, /^\/manifest\.webmanifest$/, /^\/pwa-icon\//, /^\/sw\.js$/];

export function proxy(request: NextRequest) {
  if (!accessCodeRequired()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (OPEN.some((open) => open.test(pathname))) return NextResponse.next();
  if (isProofValid(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();
  // A page is sent to the code page and then back; anything else (a form post, a data request) is just refused.
  if (request.method === "GET" || request.method === "HEAD") {
    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return new NextResponse("The access code is needed first.", { status: 403 });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
