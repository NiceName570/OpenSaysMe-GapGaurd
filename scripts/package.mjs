import fs from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Packs the built extension/ folder into dist/OpenSaysMe.zip for sharing.
// Files sit at the top of the ZIP, so Windows "Extract All" and macOS both create
// one OpenSaysMe folder with manifest.json directly inside: the folder to load.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'extension');
const dist = path.join(root, 'dist');
const zipName = 'OpenSaysMe.zip';
const readmeName = 'READ ME FIRST.txt';

let manifest;
try { manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8')); }
catch { throw new Error(`No built extension at ${source}. Run npm run build first.`); }

// Refuse to share a package that would fail at Load unpacked.
const required = [manifest.background?.service_worker, manifest.action?.default_popup, manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}), ...Object.values(manifest.action?.default_icon ?? {}),
  ...(manifest.content_scripts ?? []).flatMap(row => [...(row.js ?? []), ...(row.css ?? [])]),
  ...(manifest.declarative_net_request?.rule_resources ?? []).map(row => row.path)].filter(Boolean);
for (const file of required) {
  try { await fs.access(path.join(source, file)); }
  catch { throw new Error(`manifest.json lists ${file}, but it is missing from ${source}.`); }
}

async function walk(directory) {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(file));
    else if (item.isFile()) result.push(file);
  }
  return result;
}

const readme = (await fs.readFile(path.join(root, 'docs/READ-ME-FIRST.txt'), 'utf8'))
  .replaceAll('{{version}}', manifest.version).replace(/\r?\n/g, '\r\n');
const entries = [{ name: readmeName, data: Buffer.from(readme, 'utf8') }];
for (const file of (await walk(source)).sort()) {
  const name = path.relative(source, file).replaceAll('\\', '/');
  if (name === readmeName) continue;
  entries.push({ name, data: await fs.readFile(file) });
}

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const locals = [];
const centrals = [];
let offset = 0;
for (const { name, data } of entries) {
  const nameBytes = Buffer.from(name, 'utf8');
  const deflated = deflateRawSync(data, { level: 9 });
  const stored = deflated.length >= data.length;
  const body = stored ? data : deflated;
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(stored ? 0 : 8, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  locals.push(local, nameBytes, body);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(stored ? 0 : 8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, nameBytes);
  offset += local.length + nameBytes.length + body.length;
}
const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
if (entries.length > 0xffff || offset > 0xffffffff) throw new Error('Package is too large for a standard ZIP.');

await fs.mkdir(dist, { recursive: true });
const zipPath = path.join(dist, zipName);
await fs.writeFile(zipPath, Buffer.concat([...locals, ...centrals, end]));
const size = (await fs.stat(zipPath)).size;
console.log(`Packaged ${entries.length} files (version ${manifest.version}) into dist/${zipName}, ${(size / 1048576).toFixed(1)} MB.`);
console.log(`Send that file with its "${readmeName}" steps. Unzipping creates one OpenSaysMe folder to load.`);
