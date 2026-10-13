import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessCodeForm } from "@/components/AccessCodeForm";
import { safeReturnPath } from "@/lib/auth";
import { ACCESS_COOKIE, accessCodeRequired, isProofValid } from "@/lib/access-guard";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Access code · Chalkwork" };

// The front door: the code of the site, asked once per device.
export default async function AccessPage({ searchParams }: PageProps<"/access">) {
  const next = safeReturnPath((await searchParams).next);
  if (!accessCodeRequired() || isProofValid((await cookies()).get(ACCESS_COOKIE)?.value)) redirect(next);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Access code</h1>
      <p className="sketch-box px-4 py-3 text-ink-muted">This site is shared with a few people. Enter the code you were given to come in.</p>
      <AccessCodeForm next={next} />
    </div>
  );
}
