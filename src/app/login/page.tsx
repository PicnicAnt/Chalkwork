import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessCodeForm, DevLoginForm } from "@/components/DevLoginForm";
import { getCurrentUser, safeReturnPath } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { DEV_PROVIDER, devLoginEnabled, hasAccess } from "@/lib/dev-login";

export const metadata: Metadata = { title: "Sign in · Chalkwork" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeReturnPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  const testLogin = devLoginEnabled();
  // With an access code, the people are not listed to a device that has not given it yet.
  const allowed = await hasAccess();
  const knownUsers = testLogin && allowed ? listUsers(DEV_PROVIDER).map((u) => ({ name: u.name, boards: u.boards })) : [];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold sm:text-4xl">Sign in</h1>

      {testLogin ? (
        <>
          <p className="sketch-box px-4 py-3 text-ink-muted">
            This is a test login. {process.env.CHALKWORK_ACCESS_CODE ? "Anyone with the access code" : "It has no password: anyone"} can sign in as any name. It will be replaced by a proper sign-in, such as Google.
          </p>
          {allowed ? <DevLoginForm next={next} knownUsers={knownUsers} /> : <AccessCodeForm next={next} />}
        </>
      ) : (
        <p className="text-ink-muted">Sign-in isn&apos;t available right now.</p>
      )}
    </div>
  );
}
