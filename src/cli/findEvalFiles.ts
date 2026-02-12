import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const evalFileRegex = /\.eval\.(js|ts)$/;
const ignoredDirs = new Set([".git", "node_modules"]);

export async function findEvalFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          return;
        }
        files.push(...(await findEvalFiles(fullPath)));
        return;
      }

      if (entry.isFile() && evalFileRegex.test(entry.name)) {
        files.push(fullPath);
      }
    }),
  );

  return files;
}
