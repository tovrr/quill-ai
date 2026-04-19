/**
 * Generate Tauri desktop app icons from the existing favicon.svg
 * Run: node scripts/desktop-icons.mjs
 * Requires: npm install sharp (already a devDependency)
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgBuffer = readFileSync(join(__dirname, "../public/favicon.svg"));
const outDir = join(__dirname, "../desktop/src-tauri/icons");

mkdirSync(outDir, { recursive: true });

const pngIcons = [
  { size: 32, file: "32x32.png" },
  { size: 128, file: "128x128.png" },
  { size: 256, file: "128x128@2x.png" },
  { size: 256, file: "icon.png" },
  { size: 512, file: "icon@2x.png" },
];

for (const { size, file } of pngIcons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(outDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}

// .ico for Windows: embed 16, 32, 48, 256 sizes
// sharp can write ICO via png → manual ICO header is complex;
// use the 256px PNG and let Tauri's bundler handle ICO conversion,
// or use a separate tool. Write a note for CI.
const icoSizes = [16, 32, 48, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((s) =>
    sharp(svgBuffer).resize(s, s).png().toBuffer(),
  ),
);

// Build a minimal ICO file (ICONDIR + image entries)
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(count, 4); // count

  const entries = Buffer.alloc(count * 16);
  for (let i = 0; i < count; i++) {
    const sz = sizes[i];
    const imgSize = pngBuffers[i].length;
    entries.writeUInt8(sz >= 256 ? 0 : sz, i * 16);      // width (0 = 256)
    entries.writeUInt8(sz >= 256 ? 0 : sz, i * 16 + 1);  // height
    entries.writeUInt8(0, i * 16 + 2);                    // color count
    entries.writeUInt8(0, i * 16 + 3);                    // reserved
    entries.writeUInt16LE(1, i * 16 + 4);                 // planes
    entries.writeUInt16LE(32, i * 16 + 6);                // bit count
    entries.writeUInt32LE(imgSize, i * 16 + 8);           // bytes in image
    entries.writeUInt32LE(offset, i * 16 + 12);           // offset
    offset += imgSize;
  }

  return Buffer.concat([header, entries, ...pngBuffers]);
}

import { writeFileSync } from "fs";
const icoData = buildIco(icoBuffers, icoSizes);
writeFileSync(join(outDir, "icon.ico"), icoData);
console.log("✓ icon.ico (16, 32, 48, 256)");

// .icns for macOS (simplified: just write a note — full icns needs iconutil)
// Tauri CLI can auto-generate .icns from a 1024x1024 PNG with `tauri icon`
const icon1024 = await sharp(svgBuffer).resize(1024, 1024).png().toBuffer();
writeFileSync(join(outDir, "icon-1024.png"), icon1024);
console.log("✓ icon-1024.png (for tauri icon command)");
console.log("");
console.log("Tip: run `npx tauri icon desktop/src-tauri/icons/icon-1024.png` from the repo root");
console.log("     to auto-generate icon.icns and all platform variants.");
