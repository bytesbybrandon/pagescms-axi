import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseArguments, resolvePagesContext } from "../src/context.ts";
import { repositoryContentsEndpoint } from "../src/github.ts";

const entrypoint = fileURLToPath(new URL("../bin/Pages CMS AXI-axi.js", import.meta.url));

test("parses long, short, and inline repository options", () => {
  assert.deepEqual(parseArguments(["list", "-R", "owner/repo", "--branch=preview"]), {
    options: { repo: "owner/repo", branch: "preview" },
    positional: ["list"],
  });
});

test("returns a useful error for missing and unknown options", () => {
  assert.equal(parseArguments(["--repo"]).error, "Option --repo requires a value.");
  assert.equal(parseArguments(["--unknown", "value"]).error, "Unknown option --unknown.");
});

test("resolves explicit repository and branch values", () => {
  assert.deepEqual(resolvePagesContext(["--repo", "owner/repo", "--branch", "preview"]), {
    repository: "owner/repo",
    branch: "preview",
  });
});

test("rejects malformed repositories before any GitHub API call", () => {
  const context = resolvePagesContext(["--repo", "owner/../repo"]);
  assert.equal(context.repository, null);
  assert.equal(context.repositoryError, "Repository must use OWNER/REPO format.");
});

test("encodes content paths and branch references for GitHub API requests", () => {
  assert.equal(
    repositoryContentsEndpoint({ repository: "owner/repo", branch: "feature/a b" }, "content/a b.md"),
    "repos/owner/repo/contents/content/a%20b.md?ref=feature%2Fa%20b",
  );
});

test("local CLI exposes help and version without GitHub access", () => {
  const help = spawnSync(process.execPath, [entrypoint, "--help"], { encoding: "utf8" });
  const version = spawnSync(process.execPath, [entrypoint, "--version"], { encoding: "utf8" });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Commands: config, collection, content/);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^0\.1\.0\s*$/);
});
