import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRegisterFailure } = vi.hoisted(() => ({
  mockRegisterFailure: vi.fn(),
}));

vi.mock("./matcherUtils.js", () => ({
  registerFailure: mockRegisterFailure,
}));

import { toContain } from "./toContain.js";

describe("toContain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not register a failure when the expected text is included", () => {
    toContain("hello world", "world");

    expect(mockRegisterFailure).not.toHaveBeenCalled();
  });

  it("registers a failed matcher when the expected text is missing", () => {
    toContain("hello world", "missing");

    expect(mockRegisterFailure).toHaveBeenCalledWith(
      "expected 'hello world' to include 'missing'",
    );
  });
});
