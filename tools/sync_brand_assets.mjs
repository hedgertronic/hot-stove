import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "design/logo");
const publicDir = resolve(root, "app/public");
const brandDir = resolve(publicDir, "brand");

mkdirSync(brandDir, { recursive: true });

for (const [from, to] of [
  ["boiler-b6-flared.svg", resolve(brandDir, "boiler.svg")],
  ["flame-cut-a.svg", resolve(brandDir, "flame.svg")],
  ["favicon.svg", resolve(publicDir, "favicon.svg")],
]) {
  copyFileSync(resolve(source, from), to);
  console.log(`synced ${from} -> ${to.slice(root.length + 1)}`);
}
