// main.ts v2 — stream the bundled entry image to the output directory,
// verifying size, JPEG signature, and sha256 on the way.
// Node 22, standard library only, no network access.

import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1_048_576;
const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "entry.png");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const destPath = join(outputDir, "entry.png");

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// Stream a file once, hashing and counting as bytes pass through, and
// checking the first three bytes against the JPEG signature ffd8ff.
async function inspectAndCopy(from, to) {
  const hash = createHash("sha256");
  let total = 0;
  let header = Buffer.alloc(0);
  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        callback(new Error(`file exceeds the 1 MiB ceiling (${total} bytes)`));
        return;
      }
      if (header.length < 3) {
        header = Buffer.concat([header, chunk]).subarray(0, 3);
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(createReadStream(from), tap, createWriteStream(to));
  if (total === 0) fail("entry.png is empty");
  if (header.length < 3 || header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
    fail("entry.png does not start with the JPEG signature ffd8ff");
  }
  return { size: total, sha256: hash.digest("hex") };
}

async function hashOnly(path) {
  const hash = createHash("sha256");
  let total = 0;
  for await (const chunk of createReadStream(path)) {
    total += chunk.length;
    hash.update(chunk);
  }
  return { size: total, sha256: hash.digest("hex") };
}

async function main() {
  const info = await stat(sourcePath).catch(() => null);
  if (!info) fail(`entry.png not found next to main.ts at ${sourcePath}`);
  if (info.size === 0) fail("entry.png is empty");
  if (info.size > MAX_BYTES) fail(`entry.png exceeds the 1 MiB ceiling (${info.size} bytes)`);

  await mkdir(outputDir, { recursive: true });
  const source = await inspectAndCopy(sourcePath, destPath);
  const copied = await hashOnly(destPath);
  if (copied.size !== source.size) {
    fail(`copied size ${copied.size} does not match source size ${source.size}`);
  }
  if (copied.sha256 !== source.sha256) {
    fail(`copied sha256 ${copied.sha256} does not match source sha256 ${source.sha256}`);
  }
  console.log(`entry.png: ${source.size} bytes sha256 ${source.sha256} -> ${destPath}`);
}

main().catch((err) => {
  console.error(`error: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
