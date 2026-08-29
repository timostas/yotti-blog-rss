import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const ASSET_SETS = [
  { directory: "yotti-global-20260829-two-sim-roles-ig-v1", slides: 5 },
  { directory: "yotti-global-20260830-pre-purchase-checks-ig-v1", slides: 5 },
  { directory: "yotti-night-arrival-story-ig-v1", slides: 4 },
  { directory: "yotti-flight-disruption-story-ig-v1", slides: 4 },
  { directory: "yotti-flight-disruption-story-ig-approved-v1", slides: 4 },
];

function jpegDimensions(bytes) {
  assert.equal(bytes[0], 0xff, "JPEG SOI byte 1");
  assert.equal(bytes[1], 0xd8, "JPEG SOI byte 2");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG SOF dimensions not found");
}

test("Instagram social asset sets contain exactly their bounded 1080x1350 JPEG files", async () => {
  for (const { directory, slides } of ASSET_SETS) {
    const assetDir = resolve("assets/social-assets", directory);
    const expected = Array.from({ length: slides }, (_, index) => `slide-${String(index + 1).padStart(2, "0")}.jpg`);
    assert.deepEqual((await readdir(assetDir)).sort(), expected, assetDir);
    for (const filename of expected) {
      const path = join(assetDir, filename);
      const [bytes, metadata] = await Promise.all([readFile(path), stat(path)]);
      assert.deepEqual(jpegDimensions(bytes), { width: 1080, height: 1350 }, path);
      assert.ok(metadata.size > 0 && metadata.size <= 1_000_000, `${path}: file size must be 1..1000000 bytes`);
    }
  }
});
