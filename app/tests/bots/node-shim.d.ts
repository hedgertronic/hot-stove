/** Minimal ambient types for the node builtins the bot harness uses.
 * The app's tsconfig is browser-oriented (types: ["vite/client"], no
 * @types/node), and the harness must not touch shared config — so the
 * handful of node globals it needs are declared here instead. Trash this
 * file if @types/node is ever added to the project. */

declare module "node:fs" {
  const fs: {
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string): void;
    readdirSync(path: string): string[];
  };
  export default fs;
}

declare module "node:path" {
  const path: {
    resolve(...parts: string[]): string;
    join(...parts: string[]): string;
    dirname(path: string): string;
  };
  export default path;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}

declare const process: { env: Record<string, string | undefined> };

declare function setImmediate(callback: (...args: unknown[]) => void): unknown;
