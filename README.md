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
- **Variables:** the editor lists every variable with its name and a short note. Renaming a variable rewrites every formula that uses it (`src/lib/rename.ts`); notes are stored per calculation (`variable_descriptions`) and shown under the variable.
- **Sharing:** saving a calculation gives it an unguessable link at `/c/<id>`.
- **Editing:** creating a calculation hands the browser a secret edit key (only its SHA-256 hash is stored, in `edit_key_hash`). `/c/<id>/edit` saves changes in place when the browser has the key, and otherwise saves a new copy. There are no accounts yet; the home page lists calculations created in the current browser (kept in localStorage).

## Layout

- `src/app/page.tsx`: home page
- `src/app/new/page.tsx`: create a calculation
- `src/app/c/[id]/page.tsx`: shared calculation page
- `src/app/c/[id]/edit/page.tsx`: edit (or copy) a calculation
- `src/app/actions.ts`: server action that validates and saves
- `src/lib/calculation.ts`: types and validation shared by client and server
- `src/lib/formulas.ts`: formula parsing, input detection, and evaluation
- `src/lib/db.ts`: SQLite access
