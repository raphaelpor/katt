import { describe, expect, it } from "vitest";
import {
  bold,
  cyan,
  cyanBold,
  yellow,
  yellowBold,
  orange,
  orangeBold,
} from "./color.js";

describe("color helpers", () => {
  it("wraps text in cyan ANSI codes", () => {
    expect(cyan("value")).toBe("\u001B[36mvalue\u001B[0m");
  });

  it("wraps text in bold ANSI codes", () => {
    expect(bold("value")).toBe("\u001B[1mvalue\u001B[0m");
  });

  it("wraps text in bold cyan ANSI codes", () => {
    expect(cyanBold("value")).toBe("\u001B[1;36mvalue\u001B[0m");
  });

  it("wraps text in bold yellow ANSI codes", () => {
    expect(yellowBold("value")).toBe("\u001B[1;33mvalue\u001B[0m");
  });

  it("wraps text in yellow ANSI codes", () => {
    expect(yellow("value")).toBe("\u001B[33mvalue\u001B[0m");
  });

  it("wraps text in orange ANSI codes", () => {
    expect(orange("value")).toBe("\u001B[38;5;208mvalue\u001B[0m");
  });

  it("wraps text in bold orange ANSI codes", () => {
    expect(orangeBold("value")).toBe("\u001B[1;38;5;208mvalue\u001B[0m");
  });
});
