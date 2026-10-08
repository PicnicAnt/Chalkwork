import type { Metadata } from "next";
import { connection } from "next/server";
import { SuggestionList } from "@/components/SuggestionList";
import { requireUser } from "@/lib/auth";
import { listSuggestionsByAuthor, listSuggestionsForOwner } from "@/lib/db";

export const metadata: Metadata = { title: "Suggestions · Chalkwork" };

// Suggestions waiting on the signed-in user, and the ones they have sent.
export default async function SuggestionsPage() {
  const user = await requireUser("/suggestions");
  await connection();
  const received = listSuggestionsForOwner(user.id);
  const sent = listSuggestionsByAuthor(user.id);
  const open = received.filter((s) => s.status === "open").length;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Suggestions</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">
          For your boards <span className="text-lg font-normal text-ink-muted">({open} waiting)</span>
        </h2>
        {received.length === 0 ? (
          <p className="text-ink-muted">Nobody has suggested a change to one of your boards yet.</p>
        ) : (
          <SuggestionList suggestions={received} who="owner" />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Sent by you</h2>
        {sent.length === 0 ? (
          <p className="text-ink-muted">
            You haven&apos;t suggested anything. Open someone else&apos;s board and choose <em>Suggest a change</em>.
          </p>
        ) : (
          <SuggestionList suggestions={sent} who="author" />
        )}
      </section>
    </div>
  );
}
