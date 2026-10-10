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

## Drawings (visualizations)

A board can have drawings that follow its numbers live. A drawing has a **type** (shapes: circle, rectangle, triangle, ellipse, sphere, cone, cylinder, box, pyramid, donut, ring, regular polygon) and a **mapping** from the type's parameters to the board's variables, for example a rectangle with `width` and `height` taken from any two variables (stored in `visualizations`, set under **Drawings** in the editor). Nothing is tied to one board: any board whose variables fit a type can use it, and a board that uses other boards shows their drawings in each used board's panel, following the variables it brought along. A new type is an entry in `VIZ_TYPES` (`src/lib/visualizations.ts`, which describes types and checks what was saved) and a drawing function in `src/components/Visualization.tsx`; There are also **charts**, which solve the board again with other values (`evaluate` in `CalculatorPanel`): a **sweep** chart (one variable against another across a range, with the current point marked; drag the dot, or use the arrow keys on it, to set the variable on the horizontal axis), **sensitivity** bars (which inputs move a result most when each goes up or down by a percentage) and a **breakdown** bar (how a total divides into parts, and what is left), a **pie** chart, a **gauge**, side-by-side **bars**, a **heat map** (a result over a grid of two inputs) and a **dependency diagram** (how a result is built up from the variables behind it). Chart computation waits until typing pauses, so editing stays smooth. Slots are parameters (one variable), lists (several variables) and options (numbers), so more diagram types fit the same mapping. The seed script gives the shape boards their drawings and some boards charts.

## Suggested changes

On someone else's board, **Suggest a change** opens the editor with that board; saving sends a suggestion (`suggestions` table) instead of changing anything. The owner sees it under **Suggestions** (a count shows in the navigation), with a list of what it changes, and can **Approve** it (the board becomes the suggested version, checked like a normal save) or **Reject** it with an optional reason. If the board was changed after the suggestion was made, approving needs a second click (**Approve anyway**) since it replaces those changes. The author can withdraw an open suggestion, at most 5 can be open per person per board, and only the owner and the author can read a suggestion. Deleting a board deletes its suggestions. The diff is in `src/lib/change-suggestions.ts`.

## Connections view

A board that uses other boards has a **Connections** view: each used board is a pinned note and a red string runs between variables linked across boards (an option adds dotted strings for variables used in the same formula). The owner can press **Edit connections**, click one variable and then one on another board to link them, and click a solid string to cut it. This only changes the board's own links (the same as the **linked to** field).

## Getting started

**New** first shows a gallery of templates (loan payment, savings growth, rectangle, damage per second, or nothing), in `src/lib/templates.ts`; the editor opens filled in and saving makes the visitor's own board. A board has a short guide, `How does this work?`, that opens by itself the first time in a browser (remembered in local storage) and explains locks, fixed values and `?` with the real colours.

## Units

A unit label (`m`, `cm²`, `km/h`, `kWh`, `$`, `%`) is understood (`src/lib/units.ts`: its dimension in powers of length, mass and time, and its size next to the base unit; currencies, pixels and percentages are their own kinds and don't convert; time converts between ns, µs, ms, s, min, h, d, wk, mo and yr, also written as second(s), minute(s), hour(s), day(s), week(s), month(s) and year(s), with a year of 365.2425 days and a month a twelfth of it). Two things use that. **Unit warnings** in the editor (`src/lib/unit-check.ts`, with mathjs reading each formula) say when a formula adds unlike things, or its right side works out in a different kind or size of unit than the variable on the left (m written where m² comes out, cm² where m² does): they are warnings, the board can still be saved, and a variable without a known unit is left alone so the check only speaks when it is sure. On a board, a variable whose unit has others of the same kind shows a small menu to **show it in another unit** (m as cm or ft); typing then happens in the unit shown and is converted. The board itself is always worked out in the units the variables were written in, charts and scenarios show those units, and the choice of a shown unit is not remembered after a reload.

## History and pinned versions

Every save of a board is kept as a numbered version (`board_versions`: the whole draft, who saved it and why, such as "Restored version 1"). The owner sees them under **History** (`/c/<id>/history`) with what each one changed, and can restore any: the restore is saved as a new version, so it can be undone. A board that uses another board can **pin** it to a version (**Boards used**, saved in the include as `version`); a pinned board is read from that version, so later changes to the used board don't reach it until it is updated or set to follow the latest again. A used board that has a newer version says so. Existing boards got their current state as version 1.

## Sharing the exact state

**Copy link with these values** (above a board, and **Copy link** on each scenario) makes a link like `/c/<id>?state=…` that carries the numbers that were typed and which are locked, as base64 text (`src/lib/share-state.ts`, at most 6000 characters, checked when read because it comes from outside). Opening it starts the board from those values, with **Erase and start over** to go back.

## Ranges and uncertainty

Each variable can have a lowest and a highest value (in the variable editor). A value outside them gets a warning, and a variable with both gets a slider under it. The **Spread** chart draws the inputs at random between their ranges (most often near the value they have now), solves the board for each draw and shows how the result could turn out: a histogram with the 5% and 95% marks. The draws are seeded, so a board shows the same picture every time.

## Variables on their own

A formula line that is only a name (for example `speed`) declares that variable: it is listed on the board and can be used, with no result variable made for it. A board can therefore be just a list of variables for other boards to use.

## Order of variables

In the variable editor each variable has up and down arrows. The order is saved with the board and used on the board page too; variables that were never moved keep the order they first appear in. Variables of a used board are ordered within their own group.

## Writing helper

Two buttons use an AI model, and only appear when the server has a key: **Describe it** on the New page turns a sentence into a draft board (checked like any board, and opened in the editor, nothing saved until you save), and **Explain this board** on a board page writes a short explanation. Set `ANTHROPIC_API_KEY` in `.env.local` and restart. `CHALKWORK_AI_MODEL` picks the model (default `claude-haiku-5-5`) and `CHALKWORK_AI=0` turns it off. In the editor, **Ask for a change** has the helper change the board you have open as you ask (add a formula, a drawing, use another board). It shows what changed, you can go back to how it was, and nothing is saved until you save. A draft can also use existing boards (the ones whose words fit the description are offered to the model) and add drawings where they fit. Each use costs tokens, so it is for signed-in people only and limited to 10 uses an hour per person (kept in memory, so a restart resets it).

## Finding boards and the inbox

- **Tags:** a board can have up to eight tags (lower case, letters and digits). They show in the board list, and the search box finds boards by title, description, tags, formulas and variable names.
- **Used by:** a board page shows which boards use it (signed-in people only).
- **Inbox:** there is no email. `/notifications` and the count in the header list suggested changes and answers to them, and changes to boards that a user's own boards use. Several unread notifications of one kind on one board are merged into one.

## Presets

In the editor, the "Try it" section can save the numbers on screen as a named **preset** (Shortsword, Longsword, Bow). Presets are saved with the board and shown to everyone using it as a row of buttons above the variables; a click loads one. A board used inside another can start from one of its presets ("starts from" in the Boards section), and when someone adds a board to an item collection they can pick a preset too (kept in the address as `?items=gear:<board id>@Longsword`). Only the typed (locked) values of a preset are applied to an item.

## Collections

A board can have **collections** (the "Collections" section of the editor): just a name such as `parts`, and optionally which boards can be added to it. People using the board pick existing boards from a list and add them, with each board's presets as separate choices ("Frame · Large"). The added boards are kept in the address (`?items=parts:<board id>`), so a link shares them. Formulas use a collection directly: `parts.weight` is the total of `weight` over the boards in it, and `avg(parts.weight)`, `min(...)`, `max(...)`, `sum(...)` and `count(parts)` work too. Each added board gets an **Included** variable (1 or 0) that counts it or leaves it out. With nothing added the totals are 0. The creator can also put used boards in a collection ("in the collection" on a used board). A board added to a collection is just a board, so it can have its own formulas, and the same board can be used in any number of collections. Totals are ordinary formulas, so they work in any direction.

## Conditions and tables

- **Conditions:** `if(income > 40000, 2000, 1000)` picks between two values. Comparisons (`>`, `<`, `>=`, `<=`, `==`, `!=`), `and`, `or` and `a ? b : c` work too.
- **Tables:** a board can have lookup tables (an x, y list) that formulas call like functions, such as `tax_rate(income)`. A *step* table gives the y of the last row at or below the value (tiers, price lists); a *linear* table draws straight lines between rows. Outside the rows the first or last y is used. A used board keeps its own tables (they are named `alias.table` and only its own formulas call them).
- Both work backwards too, as long as the result can be reached; a jump in a formula can leave a value that no input gives, in which case the board says no values fit. Calling something that is neither built in nor a table is flagged as a problem on its line.

## Find the best

The **Find the best** section on a board picks a result to make as high or as low as possible, the variables that may change (those with a lowest and highest value, at most six) and optionally a limit on another result. It scans the ranges at random and then refines the best point step by step (`src/lib/optimize.ts`). The best settings can be put on the board or saved as a scenario. It finds a good answer, not a proven best one.

## Boards as a service

Everything for getting a board out is in the **Share** menu on the board page: copy the link, copy a link with the numbers on screen, download CSV, and the embed and web service examples.

- **Web API:** `GET /api/boards/<id>?width=5&area=20` or `POST` with `{"inputs": {...}}` returns every value the board works out. Inputs are held like numbers typed on the board and the rest is solved in any direction, so a result can be an input. Values typed into the board stay fixed unless you name them in the request, which decides what gets calculated when you solve backwards. Names are written as shown (`alias.variable`). 120 requests per minute per address, CORS open, no login.
- **Embed:** `/embed/<id>` shows just the board for an iframe. `?theme=light|dark` and `?state=` (from "Copy link with these values") are supported.
- **Export:** "Save image" under drawings and charts (PNG), "Download CSV" for the variables, scenarios and sweep charts.

## Scenarios

A signed-in user can save what is on a board as a named **scenario** (the typed values and which are locked; table `scenarios`, private to that user, at most 20 per board), load one back, and tick several to see them side by side with what the board shows now; numbers that differ are coloured. The comparison starts as each value with its **change in percent** beside it (+50%), and can also show only the values or the **difference** (+5, −2.5) or the difference **in percent** (+50%) from a chosen baseline (what the board shows now, or any ticked scenario), and writes each number in the unit chosen for that variable on the board. The board is solved again for each, so a scenario follows later changes to the board. The pure part is `src/lib/scenarios.ts`.

## Tests and backups

`npm test` runs the automated tests (`tests/`, with [Vitest](https://vitest.dev)): the formula parser and solver (forwards, backwards, locks, numeric solving, nonsense formulas), boards that use boards, board validation, drawings and charts, the list of what a suggestion changes, the database schema steps and the backups.

The database is copied with SQLite's own backup into `data/backups/` (not committed) when the production server starts, if the newest copy is more than a day old; `npm run backup` makes one on demand, and the newest 14 are kept. Set `CHALKWORK_BACKUP=0` to turn the automatic copy off. To restore, stop the site and copy a backup over `data/chalkwork.db`.

## Sample boards

`node scripts/seed.mjs` creates sample boards for the test user Martin: RPG character stats, Path of Exile DPS calculator, Monster stats and the boards that combine them (Melee build, Boss fight), and the shapes Circle, Rectangle and Triangle with Cylinder from a circle, Garden plan, Pyramid (a rectangle and two triangles), Donut (two circles), and Sphere, Cone, Box, Hexagon, Ellipse and Washer with their own drawings and charts. Running it again doesn't create duplicates.

## Layout

A **board** is what the code calls a calculation people write and share (the database table is still called `calculations`).

- `src/app/`: the pages. `page.tsx` (home), `new/` (a new board), `c/[id]/` (a board, with `edit/`, `suggest/` and `suggestions/`), `boards/` (the list), `suggestions/` (the inbox), `login/`.
- `src/app/actions/`: server actions, which check who is asking. `boards.ts` (create, update, links, delete, load a board to use), `suggestions.ts` (suggest, approve, reject, withdraw), and `prepare.ts` (checks a draft together with the boards it uses).
- `src/lib/`: logic with no screen in it.
  - `formulas.ts` parsing, solving and checking equations; `calculator.ts` what a board shows for typed values and locks; `rename.ts` renaming variables.
  - `board-draft.ts` the shape of a board and its validation; `boards.ts` boards that use boards; `resolve-boards.ts` loading them (server); `visualizations.ts` the drawing and chart types; `change-suggestions.ts` the list of what a suggestion changes; `example-board.ts` the example on a new board.
  - `auth.ts`, `dev-login.ts` sign-in; `suggestions.ts` and `board-search.ts` typeahead and board search.
  - `db/`: the SQLite connection (`client.ts`), the versioned schema (`migrations.ts`) and one file each for `users`, `boards` and `suggestions`, all reached through `@/lib/db`.
- `src/components/`: the screens' parts.
  - `ui/`: small shared pieces: `CollapsibleSection`, `Foldable` rows with `useFold` and `ExpandAllBar`, and `useCommitField` (a field applied when it is left).
  - `BoardEditor.tsx` with its sections `BoardsSection` (`BoardPicker`, `UsedBoard`), `VariableEditor` (`VariableLine`) and `VisualizationEditor` (`VisualizationItem`); `CalculatorView.tsx` the board as people use it (`VariableRow`); `ConnectionsView.tsx` the red-string view.
  - `Visualization.tsx` with `shapes/` (flat and solid shapes) and `charts/` (one file per chart), fed by `viz-values.ts`.
