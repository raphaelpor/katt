import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type PackageJson = {
  version?: unknown;
};

const packageJsonUrl = new URL("../../package.json", import.meta.url);

let cachedVersion: string | undefined;

export function getCliVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }

  try {
    const packageJsonText =
      packageJsonUrl.protocol === "data:"
        ? decodeDataUrl(packageJsonUrl)
        : readFileSync(fileURLToPath(packageJsonUrl), "utf8");
    const packageJson = JSON.parse(packageJsonText) as PackageJson;
    cachedVersion =
      typeof packageJson.version === "string" ? packageJson.version : "unknown";
  } catch {
    cachedVersion = "unknown";
  }

  return cachedVersion;
}

function decodeDataUrl(url: URL): string {
  const payloadStart = url.pathname.indexOf(",");
  if (payloadStart < 0) {
    throw new Error("Invalid data URL.");
  }

  const metadata = url.pathname.slice(0, payloadStart);
  const encodedPayload = url.pathname.slice(payloadStart + 1);
  const isBase64 = metadata.includes(";base64");

  return isBase64
    ? Buffer.from(encodedPayload, "base64").toString("utf8")
    : decodeURIComponent(encodedPayload);
}
