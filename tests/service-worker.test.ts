import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The service worker run against a pretend browser: a map for the caches and a fetch that can be switched off.
function load() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: { url: string } | string) => (typeof r === "string" ? r : r.url);
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    open: async (n: string) => {
      if (!stores.has(n)) stores.set(n, new Map());
      const s = stores.get(n)!;
      return {
        put: async (r: { url: string }, res: Response) => void s.set(key(r), res),
        keys: async () => [...s.keys()].map((u) => new Request(u)),
        delete: async (r: { url: string }) => s.delete(key(r)),
        match: async (r: { url: string }, o?: { ignoreSearch?: boolean }) => {
          const hit = o?.ignoreSearch ? [...s].find(([u]) => u.split("?")[0] === key(r).split("?")[0])?.[1] : s.get(key(r));
          return hit?.clone();
        },
      };
    },
  };
  const state = { online: true };
  const self = {
    location: { origin: "http://x.test" },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners[type] = fn),
  };
  const fetcher = async () => {
    if (!state.online) throw new TypeError("offline");
    const res = new Response("<h1>board</h1>", { status: 200 });
    // What a browser says about an answer from the same site.
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  };
  new Function("self", "caches", "fetch", readFileSync("public/sw.js", "utf8"))(self, caches, fetcher);
  async function request(path: string, init: { mode?: string; method?: string } = {}) {
    const req = { url: `http://x.test${path}`, method: init.method ?? "GET", mode: init.mode ?? "navigate" };
    let answer: Promise<Response> | undefined;
    const pending: Promise<unknown>[] = [];
    listeners.fetch({ request: req, respondWith: (p: Promise<Response>) => (answer = p), waitUntil: (p: Promise<unknown>) => pending.push(p) });
    const res = answer ? await answer : null;
    await Promise.all(pending);
    return res;
  }
  return { state, stores, request, listeners };
}

describe("the service worker", () => {
  it("keeps a board it fetched and shows it again when offline", async () => {
    const sw = load();
    expect(await (await sw.request("/c/abc123"))!.text()).toBe("<h1>board</h1>");
    sw.state.online = false;
    expect(await (await sw.request("/c/abc123"))!.text()).toBe("<h1>board</h1>");
    // A board opened with numbers in the address falls back to the kept one.
    expect(await (await sw.request("/c/abc123?state=zzz"))!.text()).toBe("<h1>board</h1>");
  });
  it("says so when an unopened page is asked for offline", async () => {
    const sw = load();
    sw.state.online = false;
    const res = (await sw.request("/c/never-opened"))!;
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/offline/i);
  });
  it("leaves editing, history and other requests to the network", async () => {
    const sw = load();
    expect(await sw.request("/c/abc123/edit")).toBeNull();
    expect(await sw.request("/c/abc123", { method: "POST" })).toBeNull();
    expect(await sw.request("/c/abc123", { mode: "cors" })).toBeNull();
  });
  it("forgets the kept pages when told to", async () => {
    const sw = load();
    await sw.request("/boards");
    expect(sw.stores.get("chalkwork-pages-v1")?.size).toBe(1);
    const pending: Promise<unknown>[] = [];
    sw.listeners.message({ data: "forget-pages", waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
    expect(sw.stores.has("chalkwork-pages-v1")).toBe(false);
  });
});
