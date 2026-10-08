# Chalkwork

Write a few formulas, then share them with a link. Inputs are worked out from the formulas, and anyone with the link can change them and see every result update instantly.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- **Stack:** Next.js (App Router) with TypeScript and Tailwind.
- **Storage:** SQLite via `better-sqlite3`, in `data/chalkwork.db` (created on first run, not committed).
- **Formulas:** one per line, `name = expression`, parsed with [mathjs](https://mathjs.org). Each formula is treated as an equation, and every name in them is a variable; there's no split between inputs and results. Functions that could redefine things (`import`, `createUnit`, `evaluate`, …) are disabled.
- **Solving:** with N variables and E equations, N − E values are held and the rest are calculated. Values the user types are locked (a lock icon toggles this; a variable with no value, shown as ``?``, is never locked) and are always held; remaining freedom is filled by unlocked variables keeping their value (preferring ones no formula defines), and everything else is recalculated. Variables that the locks (or formulas alone, like `fee = 500`) fully decide are read-only, shown with a double underline like a final answer. Equations are solved one unknown at a time, backwards numerically when needed (secant method, then bracketed bisection); groups of equations that only fit together are solved by guessing one variable and refining it until the group holds. See `src/lib/formulas.ts`.
- The values in the editor are saved as the starting values.
- **Typeahead:** the formulas box suggests variables already used in the formulas, plus functions and constants, as you type (Tab accepts, arrow keys move, Esc closes, or tap a suggestion). See `src/lib/suggestions.ts`.
- **Variables:** the editor lists every variable with its name, an optional display name (`variable_labels`; shown on the rows instead of the name, while formulas keep using the real name), a unit (a display label like `%` or `m²`, stored in `variable_units`; it doesn't affect the maths), how many decimals to show (`variable_decimals`; rounds only what is displayed, and only calculated values, never what the user typed) and a short note. Renaming a variable rewrites every formula that uses it (`src/lib/rename.ts`); notes are stored per calculation (`variable_descriptions`) and shown under the variable. `src/components/Tooltip.tsx` is a reusable hover/focus/tap tooltip for hints elsewhere; it is no longer used on the variable names.
- **Sharing:** saving a calculation gives it an unguessable link at `/c/<id>`.
- **Users and ownership:** every calculation belongs to the user who created it (`owner_id`). Anyone with the link can view and use a shared calculation; only its owner can edit it (`/c/<id>/edit` saves in place for the owner, and gives everyone else a copy of their own). Creating or copying needs a signed-in user. The home page lists the signed-in user's calculations, and **Browse** (`/boards`, signed-in users only) lists every board by every user with a live search over titles and descriptions (all words must match, case-insensitive; the query is kept in the address as `?q=`). Calculations made before users existed have no owner: they can be viewed and copied but not edited.
- **Sign-in:** `src/lib/auth.ts` is the whole sign-in layer. A *provider* proves who someone is and produces a profile (`{ provider, accountId, name }`); `signInWithProfile()` turns it into a user (created on first sight) and starts a database-backed session in an httpOnly cookie (only a hash of the token is stored). The rest of the app only asks `getCurrentUser()` and never mentions providers. The only provider today is the **test login** (`src/lib/dev-login.ts`, page `/login`): type any name, no password, so it is **not safe on the internet**. Set `CHALKWORK_DEV_LOGIN=0` to turn it off. To add Google, write a route that completes Google's OAuth flow, builds a profile from Google's id and name, and calls `signInWithProfile()`; set `COOKIE_SECURE=1` once the site is served over https.

## Layout

- `src/app/page.tsx`: home page
- `src/app/new/page.tsx`: create a calculation
- `src/app/c/[id]/page.tsx`: shared calculation page
- `src/app/c/[id]/edit/page.tsx`: edit (or copy) a calculation
- `src/app/actions.ts`: server actions that validate and save (they check who is signed in)
- `src/app/login/`: the sign-in page and its server actions
- `src/lib/auth.ts`: current user, sessions, and the provider-neutral sign-in
- `src/lib/calculation.ts`: types and validation shared by client and server
- `src/lib/formulas.ts`: formula parsing, input detection, and evaluation
- `src/lib/db.ts`: SQLite access (calculations, users, sessions)
