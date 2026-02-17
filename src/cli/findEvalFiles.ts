import { readdir } from "node:fs/promises";
import { matchesGlob, resolve } from "node:path";

const evalFileRegex = /\.eval\.(js|ts)$/;
const ignoredDirs = new Set([".git", "node_modules"]);

function shouldIgnorePath(path: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some((pattern) => {
    return path === pattern || matchesGlob(path, pattern);
  });
}

export async function findEvalFiles(
  dir: string,
  ignorePatterns: string[] = [],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          return;
        }
        if (shouldIgnorePath(fullPath, ignorePatterns)) {
          return;
        }
        files.push(...(await findEvalFiles(fullPath, ignorePatterns)));
        return;
      }

      if (
        entry.isFile() &&
        evalFileRegex.test(entry.name) &&
        !shouldIgnorePath(fullPath, ignorePatterns)
      ) {
        files.push(fullPath);
      }
    }),
  );

  return files;
}
