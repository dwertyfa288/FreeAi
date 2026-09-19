import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outPath = join(root, "dwertyfa-free-ai-0.1.2-noarch.astraplugin");

const entries = [
  { name: "MANIFEST.json", data: null },
  { name: "package.json", data: readFileSync(join(root, "package.json")) },
  { name: "plugin.toml", data: readFileSync(join(root, "plugin.toml")) },
  { name: "icon.svg", data: readFileSync(join(root, "icon.svg")) },
  { name: "dist/index.js", data: readFileSync(join(root, "dist", "index.js")) },
  { name: "ui/app.js", data: readFileSync(join(root, "ui", "app.js")) },
  { name: "ui/index.html", data: readFileSync(join(root, "ui", "index.html")) },
  { name: "ui/main.ts", data: readFileSync(join(root, "ui", "main.ts")) },
  { name: "ui/model-picker.ts", data: readFileSync(join(root, "ui", "model-picker.ts")) },
  { name: "ui/styles.css", data: readFileSync(join(root, "ui", "styles.css")) },
];

const manifestFiles: Record<string, { size: number; sha256: string }> = {};
for (const entry of entries.slice(1)) {
  manifestFiles["/" + entry.name] = {
    size: entry.data.length,
    sha256: crypto.createHash("sha256").update(entry.data).digest("hex"),
  };
}
const manifest = { name: "dwertyfa-free-ai", version: "0.1.2", entry: "dist/index.js", files: manifestFiles };
entries[0].data = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");

function dosDate(d: Date): number {
  return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
}

function dosTime(d: Date): number {
  return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
}

function crc32(buf: Buffer): number {
  let table: number[] | null = null;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const modified = new Date(2026, 8, 20, 12, 0, 0);
const localParts: Buffer[] = [];
const centralParts: Buffer[] = [];
const localOffsets: number[] = [];
let offset = 0;

for (const entry of entries) {
  const data = entry.data;
  const nameBuf = Buffer.from(entry.name, "utf8");
  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime(modified), 10);
  localHeader.writeUInt16LE(dosDate(modified), 12);
  localHeader.writeUInt32LE(crc32(data), 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuf.copy(localHeader, 30);
  localOffsets.push(offset);
  localParts.push(localHeader, data);
  offset += localHeader.length + data.length;
}

const centralDirOffset = offset;
entries.forEach((entry, index) => {
  const data = entry.data;
  const nameBuf = Buffer.from(entry.name, "utf8");
  const centralHeader = Buffer.alloc(46 + nameBuf.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(dosTime(modified), 12);
  centralHeader.writeUInt16LE(dosDate(modified), 14);
  centralHeader.writeUInt32LE(crc32(data), 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt32LE(0, 36);
  centralHeader.writeUInt32LE(localOffsets[index], 42);
  nameBuf.copy(centralHeader, 46);
  centralParts.push(centralHeader);
});

const centralDirSize = centralParts.reduce((total, part) => total + part.length, 0);
const endOfCentral = Buffer.alloc(22);
endOfCentral.writeUInt32LE(0x06054b50, 0);
endOfCentral.writeUInt16LE(0, 4);
endOfCentral.writeUInt16LE(0, 6);
endOfCentral.writeUInt16LE(entries.length, 8);
endOfCentral.writeUInt16LE(entries.length, 10);
endOfCentral.writeUInt32LE(centralDirSize, 12);
endOfCentral.writeUInt32LE(centralDirOffset, 16);

writeFileSync(outPath, Buffer.concat([...localParts, ...centralParts, endOfCentral]));
console.log("Bundle:", outPath);
console.log("Entries (in order):", entries.map((e, i) => `[${i}] ${e.name} (${e.data.length} bytes, stored)`).join("\n  "));
