import type { RepositoryContext } from "./github.ts";

const OPTION_NAMES: Record<string, string> = {
  "--repo": "repo",
  "-R": "repo",
  "--branch": "branch",
  "-b": "branch",
  "--collection": "collection",
  "-c": "collection",
  "--path": "path",
  "--data": "data",
  "--message": "message",
  "--limit": "limit",
};

export interface ParsedArguments {
  options: Record<string, string>;
  positional: string[];
  error?: string;
}

export interface PagesContext extends RepositoryContext {
  repositoryError?: string;
}

export function parseArguments(args: string[]): ParsedArguments {
  const options: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("-")) {
      positional.push(token);
      continue;
    }

    const equalsIndex = token.indexOf("=");
    const flag = equalsIndex >= 0 ? token.slice(0, equalsIndex) : token;
    const key = OPTION_NAMES[flag];
    if (!key) {
      return { options, positional, error: `Unknown option ${flag}.` };
    }

    const inlineValue = equalsIndex >= 0 ? token.slice(equalsIndex + 1) : undefined;
    const next = args[index + 1];
    const value = inlineValue ?? (next && !next.startsWith("-") ? next : undefined);
    if (value === undefined || value.length === 0) {
      return { options, positional, error: `Option ${flag} requires a value.` };
    }

    options[key] = value;
    if (inlineValue === undefined) index += 1;
  }

  return { options, positional };
}

export function resolvePagesContext(args: string[], inherited?: PagesContext): PagesContext {
  const parsed = parseArguments(args);
  const repository =
    parsed.options.repo ||
    inherited?.repository ||
    process.env.PAGESCMS_REPOSITORY ||
    process.env.GH_REPO ||
    null;
  const branch = parsed.options.branch || inherited?.branch || process.env.PAGESCMS_BRANCH || null;

  if (
    repository &&
    (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
      repository.split("/").some((part) => part === "." || part === ".."))
  ) {
    return {
      repository: null,
      branch,
      repositoryError: "Repository must use OWNER/REPO format.",
    };
  }

  return { repository, branch };
}
