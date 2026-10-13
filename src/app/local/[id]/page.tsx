import type { Metadata } from "next";
import { LocalBoardView } from "@/components/LocalBoardView";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "A board on this device · Chalkwork" };

// A board made without signing in. Its content is in the browser, so this page only says who is looking.
export default async function LocalBoardPage({ params }: PageProps<"/local/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  return <LocalBoardView id={id} signedIn={user !== null} />;
}
