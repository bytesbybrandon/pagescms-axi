import { parse as parseYaml } from "yaml";
import { type ApiResult, type RepositoryContext, repositoryContentsEndpoint, runGithubApi } from "./github.ts";

export interface ContentDefinition {
  name: string;
  label?: string;
  type: "collection" | "file" | "group";
  path?: string;
  items?: ContentDefinition[];
  fields?: Array<Record<string, unknown>>;
  format?: string;
  delimiters?: string | [string, string];
  exclude?: string[];
  subfolders?: boolean;
  operations?: Record<string, boolean>;
  view?: Record<string, unknown>;
}

export interface LoadedConfiguration {
  raw: string;
  config: Record<string, unknown>;
  entries: ContentDefinition[];
  content: ContentDefinition[];
}

export interface RepositoryFile {
  path: string;
  sha: string;
  text: string;
  size: number;
}

interface GitHubContent {
  type?: string;
  path?: string;
  name?: string;
  sha?: string;
  size?: number;
  content?: string;
  encoding?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenDefinitions(value: unknown): ContentDefinition[] {
  if (!Array.isArray(value)) return [];
  const output: ContentDefinition[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.name !== "string") continue;
    if (candidate.type === "group") {
      output.push(...flattenDefinitions(candidate.items));
      continue;
    }
    if (candidate.type !== "collection" && candidate.type !== "file") continue;
    if (typeof candidate.path !== "string" || candidate.path.length === 0) continue;
    output.push(candidate as unknown as ContentDefinition);
  }

  return output;
}

export async function readRepositoryFile(context: RepositoryContext, path: string): Promise<ApiResult<RepositoryFile>> {
  const result = await runGithubApi<GitHubContent>(repositoryContentsEndpoint(context, path));
  if (!result.ok) return result;

  const response = result.data;
  if (response.type !== "file" || typeof response.content !== "string" || typeof response.sha !== "string") {
    return { ok: false, code: "INVALID_CONTENT_RESPONSE", message: `GitHub did not return file content for ${path}.` };
  }

  if (response.encoding !== "base64") {
    return { ok: false, code: "UNSUPPORTED_CONTENT_ENCODING", message: `GitHub returned unsupported encoding for ${path}.` };
  }

  return {
    ok: true,
    data: {
      path: response.path || path,
      sha: response.sha,
      text: Buffer.from(response.content.replace(/\s/g, ""), "base64").toString("utf8"),
      size: response.size || 0,
    },
  };
}

export async function loadConfiguration(context: RepositoryContext): Promise<ApiResult<LoadedConfiguration>> {
  const file = await readRepositoryFile(context, ".pages.yml");
  if (!file.ok) {
    const missing = file.message.includes("404");
    return {
      ok: false,
      code: missing ? "PAGES_CONFIG_NOT_FOUND" : file.code,
      message: missing ? "Repository has no .pages.yml configuration." : file.message,
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(file.data.text);
  } catch (error) {
    return {
      ok: false,
      code: "PAGES_CONFIG_INVALID",
      message: error instanceof Error ? error.message : "Could not parse .pages.yml.",
    };
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.content)) {
    return { ok: false, code: "PAGES_CONFIG_INVALID", message: ".pages.yml must define a content list." };
  }

  return {
    ok: true,
    data: {
      raw: file.data.text,
      config: parsed,
      entries: flattenDefinitions(parsed.content),
      content: parsed.content as ContentDefinition[],
    },
  };
}

export async function listRepositoryDirectory(
  context: RepositoryContext,
  path: string,
): Promise<ApiResult<GitHubContent[]>> {
  const result = await runGithubApi<GitHubContent[] | GitHubContent>(repositoryContentsEndpoint(context, path));
  if (!result.ok) return result;
  if (Array.isArray(result.data)) return { ok: true, data: result.data };
  if (result.data.type === "file") return { ok: true, data: [result.data] };
  return { ok: false, code: "INVALID_CONTENT_RESPONSE", message: `GitHub did not return a file list for ${path}.` };
}

export async function writeRepositoryFile(
  context: RepositoryContext,
  path: string,
  text: string,
  message: string,
  sha?: string,
): Promise<ApiResult<unknown>> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(text, "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;
  if (context.branch) body.branch = context.branch;

  return runGithubApi(repositoryContentsEndpoint(context, path), body);
}
