// The writing helper: describe a calculation in a sentence and get draft formulas, units and notes; or have a
// board explained. The model is asked over the Messages API with a key kept on the server (ANTHROPIC_API_KEY).
// Each use costs tokens, so it is for signed-in people only, limited per person, and short in and out.
//
// What the model returns is never trusted: a draft goes through the same checks as any saved board.

export const AI_LIMITS = { description: 500, perHour: 10, maxTokens: 1500 };

export type Ask = (system: string, user: string) => Promise<string>;

// What the helper needs from the environment, or why it can't run.
export function aiConfig(env: Record<string, string | undefined> = process.env): { key: string; model: string } | { error: string } {
  if (env.CHALKWORK_AI === "0") return { error: "The writing helper is turned off." };
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { error: "The writing helper isn't set up on this server (no ANTHROPIC_API_KEY)." };
  return { key, model: env.CHALKWORK_AI_MODEL?.trim() || "claude-haiku-5-5" };
}

export function messagesAsk(config: { key: string; model: string }, fetcher: typeof fetch = fetch): Ask {
  return async (system, user) => {
    const response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: AI_LIMITS.maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!response.ok) throw new Error(`The model answered with an error (${response.status}).`);
    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    return (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  };
}

// At most so many uses per person per hour, kept in memory (a restart forgets it, which is fine for a cost guard).
export function makeLimiter(perHour: number, now: () => number = Date.now) {
  const uses = new Map<string, number[]>();
  return (who: string): boolean => {
    const since = now() - 3_600_000;
    const recent = (uses.get(who) ?? []).filter((t) => t > since);
    if (recent.length >= perHour) {
      uses.set(who, recent);
      return false;
    }
    uses.set(who, [...recent, now()]);
    return true;
  };
}

// The first JSON object in a reply, which may be wrapped in text or a code fence.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const DRAFT_SYSTEM = `You write the starting point of a "board" for Chalkwork, a tool where formulas work in every direction.
Reply with ONE JSON object and nothing else, with these keys:
- "title": short title (string)
- "description": one or two sentences on what the board is for (string)
- "formulas": array of strings, each "name = expression". Names are lower snake_case, written with letters, digits and underscores. Expressions use + - * / ^, parentheses, functions such as sqrt, min, max, round, abs, if(condition, a, b), and comparisons. No units inside formulas. Keep to the formulas that are needed, at most 12.
- "values": object, a sensible starting number (as a string) for each input variable
- "units": object, a unit label for variables where one fits (m, m², kg, %, $, h, ...)
- "labels": object, a friendly display name for each variable
- "descriptions": object, a short note for variables that need one
Use only variable names that appear in the formulas. Percentages are written as numbers like 5 for 5% and divided by 100 in the formulas.`;

const EXPLAIN_SYSTEM = `You explain a Chalkwork board to someone who has just opened it. Chalkwork boards are formulas that work in every direction: any variable can be typed and the others adjust. In plain language and at most 150 words: say what the board calculates, name the main inputs and results, and mention one thing worth trying (for example typing a result to solve for an input). No headings and no formulas repeated word for word.`;

export type DraftResult = { ok: true; draft: Record<string, unknown> } | { ok: false; error: string };

// Asks for a draft and checks it with `check` (the same validation as a saved board). If the check finds problems
// the model gets one chance to fix them.
export async function draftFrom(
  ask: Ask,
  description: string,
  check: (payload: unknown) => { ok: true } | { ok: false; errors: string[] },
): Promise<DraftResult> {
  const text = description.trim().slice(0, AI_LIMITS.description);
  if (!text) return { ok: false, error: "Describe what you want to calculate first." };
  let prompt = `Draft a board for this: ${text}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply: string;
    try {
      reply = await ask(DRAFT_SYSTEM, prompt);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "The helper couldn't be reached." };
    }
    const json = extractJson(reply);
    if (!json || typeof json !== "object") {
      prompt = `${prompt}\n\nYour last reply was not a single JSON object. Reply with only the JSON object.`;
      continue;
    }
    const result = check(json);
    if (result.ok) return { ok: true, draft: json as Record<string, unknown> };
    prompt = `${prompt}\n\nYour last draft had these problems: ${result.errors.slice(0, 5).join(" ")}\nReply with a corrected JSON object.`;
  }
  return { ok: false, error: "The helper couldn't produce a draft that works. Try describing it differently." };
}

export function explainWith(ask: Ask, board: { title: string; description: string; formulas: string[]; labels: Record<string, string>; units: Record<string, string> }): Promise<string> {
  const lines = [
    `Title: ${board.title}`,
    board.description ? `Description: ${board.description}` : "",
    "Formulas:",
    ...board.formulas,
    Object.keys(board.labels).length ? `Display names: ${JSON.stringify(board.labels)}` : "",
    Object.keys(board.units).length ? `Units: ${JSON.stringify(board.units)}` : "",
  ].filter(Boolean);
  return ask(EXPLAIN_SYSTEM, lines.join("\n").slice(0, 6000));
}
