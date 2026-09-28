#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourceCli = new URL("../src/cli.ts", import.meta.url);
const runningFromCheckout = existsSync(fileURLToPath(sourceCli));
const runtimeDirectory = runningFromCheckout ? "src" : "dist";
const runtimeExtension = runningFromCheckout ? ".ts" : ".js";
const { VERSION } = await import(new URL(`../${runtimeDirectory}/version${runtimeExtension}`, import.meta.url));

const versionFlags = new Set(["-v", "-V", "--version", "--v"]);
const validFlags = ["-h", "--help", "-v", "-V", "--version", "--v"];
const args = process.argv.slice(2);

if (args.length === 1 && versionFlags.has(args[0])) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

if (args[0]?.startsWith("-") && !validFlags.includes(args[0])) {
  process.stderr.write(
    `error: Unknown flag ${args[0]}\ncode: VALIDATION_ERROR\nvalid_flags[${validFlags.length}]: ${validFlags.join(",")}\n`,
  );
  process.exitCode = 2;
} else {
  const { main } = await import(new URL(`../${runtimeDirectory}/cli${runtimeExtension}`, import.meta.url));
  await main();
}
