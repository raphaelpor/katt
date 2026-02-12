import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockYellow, mockOrange, mockOrangeBold, mockGetCliVersion } =
  vi.hoisted(() => ({
    mockYellow: vi.fn((value: string) => `[yellow:${value}]`),
    mockOrange: vi.fn((value: string) => `[orange:${value}]`),
    mockOrangeBold: vi.fn((value: string) => `[orangeBold:${value}]`),
    mockGetCliVersion: vi.fn(() => "9.9.9"),
  }));

vi.mock("../lib/output/color.js", () => ({
  yellow: mockYellow,
  orange: mockOrange,
  orangeBold: mockOrangeBold,
}));

vi.mock("./version.js", () => ({
  getCliVersion: mockGetCliVersion,
}));

import { displayBanner } from "./banner.js";

describe("displayBanner", () => {
  beforeEach(() => {
    mockYellow.mockClear();
    mockOrange.mockClear();
    mockOrangeBold.mockClear();
    mockGetCliVersion.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the colored katt banner to the console", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    displayBanner();

    const line1 = " ██╗  ██╗ █████╗ ████████╗████████╗";
    const line2 = " ██║ ██╔╝██╔══██╗╚══██╔══╝╚══██╔══╝";
    const line3 = " █████╔╝ ███████║   ██║      ██║";
    const line4 = " ██╔═██╗ ██╔══██║   ██║      ██║";
    const line5 = " ██║  ██╗██║  ██║   ██║      ██║";
    const line6 = " ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝";
    const version = "v9.9.9";
    const versionPadding = Math.max(
      0,
      Math.floor((line1.length - version.length) / 2),
    );
    const versionLine = `${" ".repeat(versionPadding)}${version}`;

    expect(mockYellow).toHaveBeenNthCalledWith(1, line1);
    expect(mockYellow).toHaveBeenNthCalledWith(2, line2);
    expect(mockYellow).toHaveBeenNthCalledWith(3, line3);
    expect(mockYellow).toHaveBeenNthCalledWith(4, versionLine);
    expect(mockOrange).toHaveBeenNthCalledWith(1, line4);
    expect(mockOrange).toHaveBeenNthCalledWith(2, line5);
    expect(mockOrangeBold).toHaveBeenCalledOnce();
    expect(mockOrangeBold).toHaveBeenCalledWith(line6);
    expect(mockGetCliVersion).toHaveBeenCalledOnce();

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `
[yellow:${line1}]
[yellow:${line2}]
[yellow:${line3}]
[orange:${line4}]
[orange:${line5}]
[orangeBold:${line6}]
[yellow:${versionLine}]
`,
    );
  });
});
