# CalcShare

Create calculations from named inputs and formulas, then share them with a link. Anyone with the link can change the inputs and see the results update instantly.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- **Stack:** Next.js (App Router) with TypeScript and Tailwind.
- **Storage:** SQLite via `better-sqlite3`, in `data/calcshare.db` (created on first run, not committed).
- **Formulas:** evaluated in the browser with [mathjs](https://mathjs.org). Each input or result label becomes a variable name (`Loan amount` → `loan_amount`), and a result can use inputs and any result above it. Functions that could redefine things (`import`, `createUnit`, `evaluate`, …) are disabled.
- **Sharing:** saving a calculation gives it an unguessable link at `/c/<id>`. There are no accounts yet; the home page lists calculations created in the current browser (kept in localStorage).

## Layout

- `src/app/page.tsx`: home page
- `src/app/new/page.tsx`: create a calculation
- `src/app/c/[id]/page.tsx`: shared calculation page
- `src/app/actions.ts`: server action that validates and saves
- `src/lib/calculation.ts`: types and validation shared by client and server
- `src/lib/evaluate.ts`: formula evaluation
- `src/lib/db.ts`: SQLite access
