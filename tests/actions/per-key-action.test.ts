/**
 * Tests for the PerKeyAction router.
 *
 * @author Pedro Fuentes <git@pedrofuent.es>
 * @copyright Pedro Pablo Fuentes Schuster
 * @license MIT
 */
import { describe, it, expect, vi } from "vitest";
import { PerKeyAction, type KeyHandler } from "../../src/actions/per-key-action";

vi.mock("@elgato/streamdeck", () => ({
  default: {
    logger: { debug: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
  },
  action: () => (target: unknown) => target,
  SingletonAction: class {},
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

class FakeHandler implements KeyHandler<Record<string, never>> {
  calls: string[] = [];
  constructor(public readonly id: string) {}
  onWillAppear = vi.fn(async () => { this.calls.push("appear"); });
  onDidReceiveSettings = vi.fn(async () => { this.calls.push("settings"); });
  onKeyDown = vi.fn(async () => { this.calls.push("key"); });
  onWillDisappear = vi.fn(() => { this.calls.push("disappear"); });
}

class FakeAction extends PerKeyAction<Record<string, never>, FakeHandler> {
  created: string[] = [];
  protected createHandler(id: string): FakeHandler {
    this.created.push(id);
    return new FakeHandler(id);
  }
}

function ev(id: string) {
  return { action: { id }, payload: { settings: {} } } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PerKeyAction", () => {
  it("should create one handler per action id on first appear", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    await action.onWillAppear(ev("b"));
    expect(action.created).toEqual(["a", "b"]);
  });

  it("should reuse the same handler for repeated events from one key", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    await action.onKeyDown(ev("a"));
    await action.onDidReceiveSettings(ev("a"));
    expect(action.created).toEqual(["a"]);
    expect(action.getHandler("a")!.calls).toEqual(["appear", "key", "settings"]);
  });

  it("should route events only to the handler for that key", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    await action.onWillAppear(ev("b"));
    await action.onKeyDown(ev("b"));
    expect(action.getHandler("a")!.onKeyDown).not.toHaveBeenCalled();
    expect(action.getHandler("b")!.onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("should dispose only the disappearing key's handler", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    await action.onWillAppear(ev("b"));
    const b = action.getHandler("b")!;
    action.onWillDisappear(ev("a"));
    expect(action.getHandler("a")).toBeUndefined();
    expect(action.getHandler("b")).toBe(b);
    expect(b.onWillDisappear).not.toHaveBeenCalled();
  });

  it("should call the handler's onWillDisappear before dropping it", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    const a = action.getHandler("a")!;
    action.onWillDisappear(ev("a"));
    expect(a.onWillDisappear).toHaveBeenCalledTimes(1);
  });

  it("should create a fresh handler when a key reappears", async () => {
    const action = new FakeAction();
    await action.onWillAppear(ev("a"));
    action.onWillDisappear(ev("a"));
    await action.onWillAppear(ev("a"));
    expect(action.created).toEqual(["a", "a"]);
  });

  it("should ignore onWillDisappear for an unknown key", () => {
    const action = new FakeAction();
    expect(() => action.onWillDisappear(ev("never-seen"))).not.toThrow();
  });
});
