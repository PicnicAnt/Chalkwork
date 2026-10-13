import type { Metadata } from "next";
import { LocalBoardEditor } from "@/components/LocalBoardEditor";

export const metadata: Metadata = { title: "Edit a board on this device · Chalkwork" };

export default async function EditLocalBoardPage({ params }: PageProps<"/local/[id]/edit">) {
  const { id } = await params;
  return <LocalBoardEditor id={id} />;
}
