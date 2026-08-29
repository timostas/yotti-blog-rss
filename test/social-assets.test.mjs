import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const ASSET_DIR = resolve("assets/social-assets/yotti-global-20260829-two-sim-roles-ig-v1");
const EXPECTED = ["slide-01.jpg", "slide-02.jpg", "slide-03.jpg", "slide-04.jpg", "slide-05.jpg"];

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

test("Instagram social assets are exactly five bounded 1080x1350 JPEG files", async () => {
  assert.deepEqual((await readdir(ASSET_DIR)).sort(), EXPECTED);
  for (const filename of EXPECTED) {
    const path = join(ASSET_DIR, filename);
    const [bytes, metadata] = await Promise.all([readFile(path), stat(path)]);
    assert.deepEqual(jpegDimensions(bytes), { width: 1080, height: 1350 }, filename);
    assert.ok(metadata.size > 0 && metadata.size <= 1_000_000, `${filename}: file size must be 1..1000000 bytes`);
  }
});
