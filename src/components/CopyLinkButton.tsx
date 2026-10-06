"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-primary shrink-0">
      {copied ? "Link copied ✓" : "Copy share link"}
    </button>
  );
}
