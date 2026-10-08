import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DevLoginForm } from "@/components/DevLoginForm";
import { getCurrentUser, safeReturnPath } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { DEV_PROVIDER, devLoginEnabled } from "@/lib/dev-login";

export const metadata: Metadata = { title: "Sign in · Chalkwork" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeReturnPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  const testLogin = devLoginEnabled();
  const knownUsers = testLogin ? listUsers(DEV_PROVIDER).map((u) => ({ name: u.name, boards: u.boards })) : [];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold sm:text-4xl">Sign in</h1>

      {testLogin ? (
        <>
          <p className="sketch-box px-4 py-3 text-ink-muted">
            This is a test login. It has no password: anyone can sign in as any name. It will be replaced by a
            proper sign-in, such as Google.
          </p>
          <DevLoginForm next={next} knownUsers={knownUsers} />
        </>
      ) : (
        <p className="text-ink-muted">Sign-in isn&apos;t available right now.</p>
      )}
    </div>
  );
}
