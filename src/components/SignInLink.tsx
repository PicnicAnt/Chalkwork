"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// "Sign in" that brings you back to the page you were on: the address is read when the link is used, so it has the
// page's own query too. Without scripts it is a plain link to the sign-in page.
export function SignInLink() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Link
      href="/login"
      className="link text-lg"
      onClick={(e) => {
        if (pathname.startsWith("/login") || pathname.startsWith("/access")) return;
        e.preventDefault();
        router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      }}
    >
      Sign in
    </Link>
  );
}
