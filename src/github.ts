import { spawn } from "node:child_process";

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export interface RepositoryContext {
  repository: string | null;
  branch: string | null;
}

export function repositoryContentsEndpoint(context: RepositoryContext, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const ref = context.branch ? `?ref=${encodeURIComponent(context.branch)}` : "";
  return `repos/${context.repository}/contents/${encodedPath}${ref}`;
}

export function runGithubApi<T = unknown>(endpoint: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  const args = ["api", endpoint];
  if (body) {
    args.push("--method", "PUT", "--input", "-");
  }

  return new Promise((resolve) => {
    let settled = false;
    let overflow = false;
    let stdout = "";
    let stderr = "";
    const child = spawn("gh", args, { windowsHide: true });

    const finish = (result: ApiResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: "GITHUB_API_TIMEOUT", message: "GitHub API request timed out." });
    }, REQUEST_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, "utf8") > MAX_RESPONSE_BYTES) {
        overflow = true;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, "utf8") > 64 * 1024) {
        stderr = `${stderr.slice(0, 64 * 1024)}…`;
      }
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        code: error.code === "ENOENT" ? "GH_CLI_NOT_FOUND" : "GH_CLI_FAILED",
        message: error.code === "ENOENT" ? "GitHub CLI was not found. Install gh and run gh auth login." : error.message,
      });
    });
    child.on("close", (exitCode: number | null) => {
      if (overflow) {
        finish({ ok: false, code: "GITHUB_RESPONSE_TOO_LARGE", message: "GitHub API response exceeded the 8 MiB limit." });
        return;
      }

      let parsed: unknown;
      if (stdout.trim()) {
        try {
          parsed = JSON.parse(stdout);
        } catch {
          parsed = undefined;
        }
      }

      if (exitCode !== 0) {
        const apiMessage =
          parsed && typeof parsed === "object" && "message" in parsed
            ? String((parsed as { message: unknown }).message)
            : stderr.trim() || stdout.trim() || "GitHub API request failed.";
        finish({ ok: false, code: "GITHUB_API_ERROR", message: apiMessage });
        return;
      }

      if (parsed === undefined) {
        finish({ ok: false, code: "INVALID_GITHUB_RESPONSE", message: "GitHub CLI did not return valid JSON." });
        return;
      }

      finish({ ok: true, data: parsed as T });
    });

    if (body) child.stdin.end(JSON.stringify(body));
    else child.stdin.end();
  });
}
