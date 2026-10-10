import { describe, expect, it } from "vitest";
import { aiConfig, draftFrom, explainWith, extractJson, makeLimiter, messagesAsk } from "@/lib/ai";

describe("the writing helper", () => {
  it("needs a key, and can be switched off", () => {
    expect("error" in aiConfig({})).toBe(true);
    expect(aiConfig({ ANTHROPIC_API_KEY: "k" })).toMatchObject({ key: "k" });
    expect(aiConfig({ ANTHROPIC_API_KEY: "k", CHALKWORK_AI_MODEL: "m" })).toMatchObject({ model: "m" });
    expect("error" in aiConfig({ ANTHROPIC_API_KEY: "k", CHALKWORK_AI: "0" })).toBe(true);
  });

  it("finds the JSON object in a reply with text or a code fence around it", () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson("no object")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });

  it("limits uses per person per hour", () => {
    let t = 0;
    const allowed = makeLimiter(2, () => t);
    expect([allowed("a"), allowed("a"), allowed("a"), allowed("b")]).toEqual([true, true, false, true]);
    t += 3_600_001;
    expect(allowed("a")).toBe(true);
  });

  it("returns a draft that passes the checks", async () => {
    const out = await draftFrom(
      async () => '{"title":"Trip","formulas":["time = distance / speed"]}',
      "how long a trip takes",
      () => ({ ok: true }),
    );
    expect(out).toEqual({ ok: true, draft: { title: "Trip", formulas: ["time = distance / speed"] } });
  });

  it("gives the model one chance to fix a draft that fails the checks", async () => {
    const prompts: string[] = [];
    const replies = ['{"formulas":["a = a - 1"]}', '{"formulas":["a = b * 2"]}'];
    const out = await draftFrom(
      async (_system, user) => {
        prompts.push(user);
        return replies[prompts.length - 1];
      },
      "double b",
      (payload) => ((payload as { formulas: string[] }).formulas[0] === "a = b * 2" ? { ok: true } : { ok: false, errors: ["Line 1: no value satisfies this equation"] }),
    );
    expect(out.ok).toBe(true);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/no value satisfies/);
  });

  it("gives up after the second try, and reports a failure to reach the model", async () => {
    const bad = await draftFrom(async () => "sorry", "x", () => ({ ok: true }));
    expect(bad.ok).toBe(false);
    const down = await draftFrom(async () => { throw new Error("down"); }, "x", () => ({ ok: true }));
    expect(down).toEqual({ ok: false, error: "down" });
    expect((await draftFrom(async () => "{}", "   ", () => ({ ok: true }))).ok).toBe(false);
  });

  it("asks the Messages API with the key and reads the text back", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Hello" }, { type: "text", text: " there" }] }) };
    }) as unknown as typeof fetch;
    const ask = messagesAsk({ key: "secret", model: "m" }, fake);
    expect(await ask("sys", "hi")).toBe("Hello there");
    expect(seen!.url).toBe("https://api.anthropic.com/v1/messages");
    expect((seen!.init.headers as Record<string, string>)["x-api-key"]).toBe("secret");
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ model: "m", system: "sys" });
    const failing = messagesAsk({ key: "k", model: "m" }, (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch);
    await expect(failing("s", "u")).rejects.toThrow(/429/);
  });

  it("explains a board from its formulas", async () => {
    let sent = "";
    const text = await explainWith(
      async (_s, user) => ((sent = user), "It works out an area."),
      { title: "Rectangle", description: "", formulas: ["area = w * h"], labels: {}, units: { area: "m²" } },
    );
    expect(text).toBe("It works out an area.");
    expect(sent).toMatch(/area = w \* h/);
  });
});

describe("offering boards and drawings to the helper", () => {
  const boards = [
    { title: "Rectangle", description: "Area and perimeter", keywords: "area = width * height", tags: ["geometry"] },
    { title: "Loan payment", description: "Monthly payment", keywords: "payment", tags: ["finance"] },
  ];

  it("offers the boards whose words fit the description", async () => {
    const { relevantBoards } = await import("@/lib/ai");
    expect(relevantBoards(boards, "a box with width, height and depth").map((b) => b.title)).toEqual(["Rectangle"]);
    expect(relevantBoards(boards, "something unrelated")).toEqual([]);
  });

  it("writes the catalog as text and puts it in the system prompt", async () => {
    const { catalogText } = await import("@/lib/ai");
    const text = catalogText(
      [{ id: "abc", title: "Rectangle", description: "Area", variables: ["width", "height"] }],
      [{ id: "box", label: "Box", params: [{ key: "width", label: "Width" }], lists: [], options: [] }],
    );
    expect(text).toMatch(/id abc: "Rectangle"/);
    expect(text).toMatch(/box \(Box\): width: Width/);
    let system = "";
    await draftFrom(async (s) => ((system = s), '{"title":"x"}'), "a box", () => ({ ok: true }), text);
    expect(system).toMatch(/Existing boards that can be used/);
    expect(system).toMatch(/"includes"/);
  });
});
