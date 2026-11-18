// main.ts v1 — copy the bundled entry image to the output directory.
// Node 22, standard library only, no network access.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "entry.png");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const destPath = join(outputDir, "entry.png");

async function main() {
  const data = await readFile(sourcePath);
  if (data.length === 0) {
    console.error("error: entry.png is empty");
    process.exit(1);
  }
  await mkdir(outputDir, { recursive: true });
  await writeFile(destPath, data);
  const copied = await readFile(destPath);
  if (!copied.equals(data)) {
    console.error("error: copied file does not match source bytes");
    process.exit(1);
  }
  console.log(`entry.png copied: ${data.length} bytes -> ${destPath}`);
}

main().catch((err) => {
  console.error(`error: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
