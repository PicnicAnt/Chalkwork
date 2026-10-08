"use client";

import { useActionState } from "react";
import { devSignIn, enterAccessCode, type LoginState } from "@/app/login/actions";

export type KnownUser = { name: string; boards: number };

// The test login. The people who have signed in before come first, one tap each; below that,
// a new name can be typed, which creates that user.
export function DevLoginForm({ next, knownUsers }: { next: string; knownUsers: KnownUser[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(devSignIn, {});

  return (
    <div className="flex flex-col gap-8">
      {knownUsers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Sign in as</h2>
          <ul className="flex flex-col gap-2">
            {knownUsers.map((user) => (
              <li key={user.name}>
                <form action={action}>
                  <input type="hidden" name="next" value={next} />
                  <input type="hidden" name="name" value={user.name} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn flex w-full items-baseline justify-between gap-4 text-left text-xl"
                  >
                    <span className="truncate">{user.name}</span>
                    <span className="shrink-0 text-base text-ink-muted">
                      {user.boards === 1 ? "1 board" : `${user.boards} boards`}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="dev-name" className="text-2xl font-bold">
            {knownUsers.length > 0 ? "Or type a new name" : "Type a name to start"}
          </label>
          <input
            id="dev-name"
            name="name"
            className="field text-2xl"
            placeholder="New user name"
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
      </section>
    </div>
  );
}
// Asked once per device when the site has an access code; after it, the users are listed.
export function AccessCodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(enterAccessCode, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="access-code" className="text-2xl font-bold">
        Access code
      </label>
      <input
        id="access-code"
        name="code"
        type="password"
        className="field text-2xl"
        placeholder="Access code"
        autoComplete="off"
        required
      />
      {state.error && <p className="text-danger">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Checking…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
