# CalcShare

Write a few formulas, then share them with a link. Inputs are worked out from the formulas, and anyone with the link can change them and see every result update instantly.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- **Stack:** Next.js (App Router) with TypeScript and Tailwind.
- **Storage:** SQLite via `better-sqlite3`, in `data/calcshare.db` (created on first run, not committed).
- **Formulas:** one per line, `name = expression`, parsed and evaluated with [mathjs](https://mathjs.org). Every name a formula uses but no formula defines becomes an input; formulas can refer to each other in any order and are evaluated in dependency order (loops are reported). Functions that could redefine things (`import`, `createUnit`, `evaluate`, …) are disabled. The creator's values in the editor are saved as starting values.
- **Two-way:** results are editable too. Typing a result solves numerically (secant method, then a bracketed bisection) for one input behind it: by default the least recently edited one, or whichever the user picks under the field.
- **Sharing:** saving a calculation gives it an unguessable link at `/c/<id>`. There are no accounts yet; the home page lists calculations created in the current browser (kept in localStorage).

## Layout

- `src/app/page.tsx`: home page
- `src/app/new/page.tsx`: create a calculation
- `src/app/c/[id]/page.tsx`: shared calculation page
- `src/app/actions.ts`: server action that validates and saves
- `src/lib/calculation.ts`: types and validation shared by client and server
- `src/lib/formulas.ts`: formula parsing, input detection, and evaluation
- `src/lib/db.ts`: SQLite access
