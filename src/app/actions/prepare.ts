import "server-only";
import { parseIncludes } from "@/lib/boards";
import { validateDraft, type CalculationDraft } from "@/lib/calculation";
import { resolveIncludes } from "@/lib/resolve-boards";

// Server actions can be called directly, not only from the page, so each one checks who is asking and what
// it was sent. This is the second part: a board's draft is checked together with the boards it uses.
// Checks what the editor sent, together with the boards it uses, and says what to save.
export function prepare(payload: unknown, selfId?: string): { draft: CalculationDraft } | { errors: string[] } {
  const { includes, errors: includeErrors } = parseIncludes((payload as { includes?: unknown } | null)?.includes);
  if (includeErrors.length) return { errors: includeErrors };
  const resolved = resolveIncludes(includes, selfId);
  if ("error" in resolved) return { errors: [resolved.error] };
  const { draft, errors } = validateDraft(payload, resolved.included);
  return draft ? { draft } : { errors };
}
