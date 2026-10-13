"use client";

import { useActionState } from "react";
import { enterAccessCode, type AccessState } from "@/app/access/actions";

// The code of the site, asked once per device.
export function AccessCodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(enterAccessCode, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="access-code" className="text-2xl font-bold">
        Access code
      </label>
      <input id="access-code" name="code" type="password" className="field text-2xl" placeholder="Access code" autoComplete="off" required autoFocus />
      {state.error && <p className="text-danger">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Checking…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
