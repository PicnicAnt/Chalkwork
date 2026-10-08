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
- **Variables:** the editor lists every variable with its name, an optional display name (`variable_labels`; shown on the rows instead of the name, while formulas keep using the real name), a unit (a display label like `%` or `m²`, stored in `variable_units`; it doesn't affect the maths), how many decimals to show (`variable_decimals`; rounds only what is displayed, and only calculated values, never what the user typed) and a short note. A variable can be hidden (`variable_hidden`): it still takes part in every calculation but is not shown on the shared board (the editor shows it dimmed, marked hidden). In the editor each variable is a folded line (name, unit, hidden or linked) that opens to its fields, with **Expand all** and **Collapse all**. Renaming a variable rewrites every formula that uses it (`src/lib/rename.ts`); notes are stored per calculation (`variable_descriptions`) and shown under the variable. `src/components/Tooltip.tsx` is a reusable hover/focus/tap tooltip for hints elsewhere; it is no longer used on the variable names.
- **Sharing:** saving a calculation gives it an unguessable link at `/c/<id>`.
- **Boards that use other boards:** a board can use existing boards (**Add an existing board** in the editor, stored in `board_includes`). Each is given an alias and, optionally, a name shown on the board in place of its title, so one board can be used twice (say as `player` and `enemy`); its variables join the board as `alias.name` (internally `alias$name`, since mathjs allows a dollar sign in a name but not a dot), together with its formulas. Anything can then be linked with an equation, such as `weapon.damage = armor.taken * 4` or `effective = weapon.dps * 3`; equations work both ways, so linked variables follow each other whichever one is changed. Used boards are read live, so a change to one shows up in every board that uses it. A board that uses others can restyle what it borrows (label, unit, note, decimals, hidden, starting value); what it sets wins. Boards may not use each other in a loop (checked when adding and when saving), chains are limited to 5 levels and 60 boards loaded at once. The pure logic is in `src/lib/boards.ts` (tested without a database or browser) and the server side in `src/lib/resolve-boards.ts`.
- **Links:** any variable can be linked to another with the **linked to** field in the Variables section (stored in `variable_links`). A link is just the equation `variable = other`, added to the board's formulas, so the two follow each other whichever one is changed. It is the way to join variables of different used boards without writing a formula, and it can join a variable of a used board to one of your own. The board shows `linked to ...` under a linked variable; links made by a used board show but can only be changed there. Removing a used board removes the links that reach into it, and renaming a variable or a board alias keeps links pointing at the right place.
- **Users and ownership:** every calculation belongs to the user who created it (`owner_id`). Anyone with the link can view and use a shared calculation; only its owner can edit it (`/c/<id>/edit` saves in place for the owner, and gives everyone else a copy of their own). Creating or copying needs a signed-in user. The home page lists the signed-in user's calculations, and **Boards** (`/boards`, signed-in users only; a switch picks all boards or only your own) lists every board by every user with a live search over titles and descriptions (all words must match, case-insensitive; the query is kept in the address as `?q=`). Calculations made before users existed have no owner: they can be viewed and copied but not edited.
- **Sign-in:** `src/lib/auth.ts` is the whole sign-in layer. A *provider* proves who someone is and produces a profile (`{ provider, accountId, name }`); `signInWithProfile()` turns it into a user (created on first sight) and starts a database-backed session in an httpOnly cookie (only a hash of the token is stored). The rest of the app only asks `getCurrentUser()` and never mentions providers. The only provider today is the **test login** (`src/lib/dev-login.ts`, page `/login`): people who have signed in before are listed first (one tap each, with their board count) and a new name can be typed to create a user; there is no password, so it is **not safe on the internet**. Set `CHALKWORK_DEV_LOGIN=0` to turn it off. To reach the site from the internet (for example through a tunnel), set `CHALKWORK_ACCESS_CODE` (in `.env.local`, which is not committed): the test login first asks for that code (once per device, remembered for a year in a cookie that holds a keyed hash of it, not the code) and only then lists the existing users. Wrong codes are counted and, after ten in ten minutes, refused for a while. To add Google, write a route that completes Google's OAuth flow, builds a profile from Google's id and name, and calls `signInWithProfile()`; set `COOKIE_SECURE=1` once the site is served over https.

## Suggested changes

On someone else's board, **Suggest a change** opens the editor with that board; saving sends a suggestion (`suggestions` table) instead of changing anything. The owner sees it under **Suggestions** (a count shows in the navigation), with a list of what it changes, and can **Approve** it (the board becomes the suggested version, checked like a normal save) or **Reject** it with an optional reason. If the board was changed after the suggestion was made, approving needs a second click (**Approve anyway**) since it replaces those changes. The author can withdraw an open suggestion, at most 5 can be open per person per board, and only the owner and the author can read a suggestion. Deleting a board deletes its suggestions. The diff is in `src/lib/change-suggestions.ts`.

## Connections view

A board that uses other boards has a **Connections** view: each used board is a pinned note and a red string runs between variables linked across boards (an option adds dotted strings for variables used in the same formula). The owner can press **Edit connections**, click one variable and then one on another board to link them, and click a solid string to cut it. This only changes the board's own links (the same as the **linked to** field).

## Sample boards

`node scripts/seed.mjs` creates sample boards for the test user Martin: RPG character stats, Path of Exile DPS calculator, Monster stats and the boards that combine them (Melee build, Boss fight), and the shapes Circle, Rectangle and Triangle with Cylinder from a circle, Garden plan, Pyramid (a rectangle and two triangles) and Donut (two circles), which link them. Running it again doesn't create duplicates.

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
