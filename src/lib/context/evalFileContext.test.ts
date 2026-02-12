import { describe, expect, it } from "vitest";
import { evalFileStorage } from "./evalFileContext.js";

describe("evalFileStorage", () => {
  it("stores and returns eval file context for a run scope", () => {
    const value = evalFileStorage.run(
      { evalFile: "/tmp/example.eval.ts" },
      () => {
        return evalFileStorage.getStore();
      },
    );

    expect(value).toEqual({ evalFile: "/tmp/example.eval.ts" });
  });

  it("returns undefined outside of a run scope", () => {
    expect(evalFileStorage.getStore()).toBeUndefined();
  });
});
