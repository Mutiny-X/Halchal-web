import { describe, expect, it } from "vitest";

import { SaveQueue } from "./save-queue";

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake API: create/update each take `ms`, like a real network call. */
function fakeServer(latency: () => number) {
  const calls: Array<{ op: "create" | "update"; id?: string; title: string }> = [];
  let nextId = 1;
  return {
    calls,
    async create(title: string) {
      await new Promise((r) => setTimeout(r, latency()));
      const id = `c${nextId++}`;
      calls.push({ op: "create", id, title });
      return id;
    },
    async update(id: string, title: string) {
      await new Promise((r) => setTimeout(r, latency()));
      calls.push({ op: "update", id, title });
    },
  };
}

describe("SaveQueue", () => {
  it("never creates two campaigns when saves overlap (auto-save + Next click)", async () => {
    const server = fakeServer(() => 20);
    const queue = new SaveQueue();
    let campaignId: string | null = null;
    let title = "Summer";
    // Mirrors the wizard's save: decide create-vs-update when the save STARTS.
    const save = () =>
      queue.run(async () => {
        if (campaignId) {
          await server.update(campaignId, title);
        } else {
          campaignId = await server.create(title);
        }
        return campaignId;
      });

    const autoSave = save();
    title = "Summer drop";
    const nextClick = save();
    await Promise.all([autoSave, nextClick]);

    expect(server.calls.filter((c) => c.op === "create")).toHaveLength(1);
    expect(server.calls.at(-1)).toEqual({ op: "update", id: "c1", title: "Summer drop" });
  });

  it("applies saves in the order they were made, even when an older request is slower", async () => {
    const latencies = [50, 1]; // first save slow, second fast
    const server = fakeServer(() => latencies.shift() ?? 1);
    const queue = new SaveQueue();
    const writes: string[] = [];
    const save = (title: string) =>
      queue.run(async () => {
        await server.update("c1", title);
        writes.push(title);
      });

    await Promise.all([save("old value"), save("new value")]);

    expect(writes).toEqual(["old value", "new value"]); // the newest write is last
  });

  it("keeps going after a failed save, and reports pending/error status", async () => {
    const statuses: Array<{ pending: number; error: unknown }> = [];
    const queue = new SaveQueue((s) => statuses.push(s));

    const failing = queue.run(async () => {
      throw new Error("network down");
    });
    const next = queue.run(async () => "saved");

    await expect(failing).rejects.toThrow("network down");
    await expect(next).resolves.toBe("saved");
    expect(statuses.at(-1)).toEqual({ pending: 0, error: null }); // success clears the error
    expect(statuses.some((s) => s.error instanceof Error)).toBe(true);
  });

  it("idle() waits for everything queued so far", async () => {
    const queue = new SaveQueue();
    let done = false;
    void queue.run(async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });
    await tick();
    expect(done).toBe(false);
    await queue.idle();
    expect(done).toBe(true);
  });
});
