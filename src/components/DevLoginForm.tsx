"use client";

import { useActionState } from "react";
import { devSignIn, type LoginState } from "@/app/login/actions";

// The test login form: type a name, or pick someone who has signed in before.
export function DevLoginForm({ next, knownUsers }: { next: string; knownUsers: string[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(devSignIn, {});

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="dev-name" className="text-xl">
          Sign in as
        </label>
        <input
          id="dev-name"
          name="name"
          className="field text-2xl"
          placeholder="Your name"
          autoComplete="off"
          autoCapitalize="words"
          maxLength={30}
          required
        />
        {state.error && <p className="text-danger">{state.error}</p>}
        <div>
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>

      {knownUsers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-muted">Or continue as someone who signed in before:</p>
          <ul className="flex flex-wrap gap-3">
            {knownUsers.map((name) => (
              <li key={name}>
                <form action={action}>
                  <input type="hidden" name="next" value={next} />
                  <input type="hidden" name="name" value={name} />
                  <button type="submit" disabled={pending} className="btn">
                    {name}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
