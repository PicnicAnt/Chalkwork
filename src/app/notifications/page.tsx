import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MarkReadButton } from "@/components/MarkReadButton";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/db";

export const metadata: Metadata = { title: "Inbox · Chalkwork" };

// What has happened to the signed-in user's boards: comments, suggestions, and changes to boards theirs use. There is
// no email; this page and the count in the header are where it shows.
export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  await connection();
  const items = listNotifications(user.id);
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Inbox</h1>
        {unread > 0 && <MarkReadButton />}
      </div>
      {items.length === 0 ? (
        <p className="text-ink-muted">Nothing yet. You are told here when someone comments on or suggests a change to one of your boards, and when a board you use is changed.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link} className="group flex flex-col gap-0.5">
                <span className={`text-xl ${n.read ? "text-ink-muted" : ""}`}>
                  {!n.read && <span className="mr-2 text-accent">●</span>}
                  <span className="group-hover:underline group-hover:decoration-wavy">{n.text}</span>
                </span>
                <span className="pl-5 text-sm text-ink-faint">{new Date(n.createdAt).toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
