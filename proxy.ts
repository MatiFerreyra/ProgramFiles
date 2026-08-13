import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "programfiles.com.ar").toLowerCase();
  const pathname = request.nextUrl.pathname;
  const systemPath = pathname.startsWith("/login") || pathname.startsWith("/portal") || pathname.startsWith("/tenant/") || pathname.startsWith("/domain/");
  if (systemPath) return NextResponse.next();

  let subdomain = "";
  if (host.endsWith(`.${rootDomain}`)) subdomain = host.slice(0, -(rootDomain.length + 1));
  else if (host.endsWith(".localhost")) subdomain = host.slice(0, -".localhost".length);

  if (subdomain && !["www","app","admin"].includes(subdomain)) {
    const url = request.nextUrl.clone();
    url.pathname = `/tenant/${encodeURIComponent(subdomain)}`;
    return NextResponse.rewrite(url);
  }

  const isRootHost = host === rootDomain || host === `www.${rootDomain}` || host === `app.${rootDomain}` || host === `admin.${rootDomain}` || host === "localhost" || host.endsWith(".vercel.app");
  if (!isRootHost && host.includes(".")) {
    const url = request.nextUrl.clone();
    url.pathname = `/domain/${encodeURIComponent(host)}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
