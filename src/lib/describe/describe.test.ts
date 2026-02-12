import { describe, expect, it } from "vitest";

import {
  getDescribePath,
  hasDescribeContext,
  resetDescribeContext,
} from "../context/context.js";
import { describe as describeFn } from "./describe.js";

describe("describe", () => {
  it("tracks describe context for the callback and clears it after", () => {
    let observedPath = "";

    describeFn("project summary", () => {
      observedPath = getDescribePath();
      expect(hasDescribeContext()).toBe(true);
    });

    expect(observedPath).toBe("project summary");
    expect(hasDescribeContext()).toBe(false);
    resetDescribeContext();
  });
});
