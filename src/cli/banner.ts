import { yellow, orangeBold, orange } from "../lib/output/color.js";
import { getCliVersion } from "./version.js";

export function displayBanner(): void {
  const line1 = " ██╗  ██╗ █████╗ ████████╗████████╗";
  const line2 = " ██║ ██╔╝██╔══██╗╚══██╔══╝╚══██╔══╝";
  const line3 = " █████╔╝ ███████║   ██║      ██║";
  const line4 = " ██╔═██╗ ██╔══██║   ██║      ██║";
  const line5 = " ██║  ██╗██║  ██║   ██║      ██║";
  const line6 = " ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝";
  const version = `v${getCliVersion()}`;
  const versionPadding = Math.max(
    0,
    Math.floor((line1.length - version.length) / 2),
  );
  const versionLine = `${" ".repeat(versionPadding)}${version}`;

  console.log(`
${yellow(line1)}
${yellow(line2)}
${yellow(line3)}
${orange(line4)}
${orange(line5)}
${orangeBold(line6)}
${yellow(versionLine)}
`);
}
