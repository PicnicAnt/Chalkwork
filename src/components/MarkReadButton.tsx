"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead } from "@/app/actions/discussion";

export function MarkReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link text-base"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllRead();
          router.refresh();
        })
      }
    >
      Mark all as read
    </button>
  );
}
