import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { type PagesContext, parseArguments, resolvePagesContext } from "./context.ts";
import { type RepositoryContext } from "./github.ts";
import { loadConfiguration, listRepositoryDirectory, readRepositoryFile, writeRepositoryFile, type ContentDefinition } from "./pages.ts";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

type ContentRecord = Record<string, unknown>;

function problem(code: string, error: string, help: string[] = []) {
  return { error, code, ...(help.length ? { help } : {}) };
}

function contentDefinitions(entries: ContentDefinition[]) {
  return entries.filter((entry) => entry.type === "collection" || entry.type === "file");
}

function findDefinition(entries: ContentDefinition[], name: string | undefined) {
  return contentDefinitions(entries).find((entry) => entry.name === name);
}

function safeRelativePath(path: string) {
  if (path.startsWith("/") || path.startsWith("\\")) return null;
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (!normalized || segments.some((segment) => segment === ".." || segment.includes(":"))) return null;
  return segments.join("/");
}

function resolveEntryPath(definition: ContentDefinition, requested: string | undefined) {
  const root = definition.path ? safeRelativePath(definition.path) : null;
  if (!root) return { error: "Configured content path is invalid." };

  if (definition.type === "file") {
    if (requested && safeRelativePath(requested) !== root) {
      return { error: `This file is configured at ${root}.` };
    }
    return { path: root };
  }

  if (!requested) return { error: "Pass --path for this collection entry." };
  const candidate = safeRelativePath(requested);
  if (!candidate) return { error: "Path must be a safe repository-relative path." };
  if (candidate === root) return { error: "Path must identify a file inside the collection." };
  if (candidate.startsWith(`${root}/`)) return { path: candidate };
  return { path: `${root}/${candidate}` };
}

function isPathWithinRoot(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

function titleFrom(data: unknown, path: string) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as ContentRecord;
    if (typeof record.title === "string" && record.title.length > 0) return record.title;
    if (typeof record.name === "string" && record.name.length > 0) return record.name;
  }
  const filename = path.split("/").pop() || path;
  return filename.replace(/\.[^.]+$/, "");
}

function frontmatterDelimiters(definition: ContentDefinition) {
  if (typeof definition.delimiters === "string") return [definition.delimiters, definition.delimiters] as const;
  if (Array.isArray(definition.delimiters) && definition.delimiters.length === 2) {
    return [definition.delimiters[0], definition.delimiters[1]] as const;
  }
  return ["---", "---"] as const;
}

function splitFrontmatter(text: string, definition: ContentDefinition) {
  const [start, end] = frontmatterDelimiters(definition);
  const lines = text.split(/\r?\n/);
  if (lines[0] !== start) return null;
  const endIndex = lines.indexOf(end, 1);
  if (endIndex < 0) return null;
  return {
    header: lines.slice(1, endIndex).join("\n"),
    body: lines.slice(endIndex + 1).join("\n").replace(/^\n/, ""),
  };
}

function parseEntry(text: string, path: string, definition: ContentDefinition) {
  const format = typeof definition.format === "string" ? definition.format : "";
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const frontmatter = format.includes("frontmatter") || ["md", "mdx"].includes(extension);

  if (frontmatter) {
    const split = splitFrontmatter(text, definition);
    if (!split) {
      const data = { body: text };
      return { title: titleFrom(data, path), data };
    }

    try {
      const metadata = format.startsWith("json") ? JSON.parse(split.header || "{}") : parseYaml(split.header || "{}") || {};
      const data = metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? { ...(metadata as ContentRecord), body: split.body }
        : { metadata, body: split.body };
      return { title: titleFrom(data, path), data };
    } catch {
      return { title: titleFrom(undefined, path), data: { frontmatter: split.header, body: split.body } };
    }
  }

  try {
    if (format === "json" || extension === "json") {
      const data = JSON.parse(text);
      return { title: titleFrom(data, path), data };
    }
    if (format === "yaml" || extension === "yaml" || extension === "yml") {
      const data = parseYaml(text);
      return { title: titleFrom(data, path), data };
    }
  } catch {
    return { title: titleFrom(undefined, path), data: { content: text, parse_error: true } };
  }

  const data = { content: text };
  return { title: titleFrom(undefined, path), data };
}

function serializeEntry(data: unknown, path: string, definition: ContentDefinition) {
  const format = typeof definition.format === "string" ? definition.format : "";
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const frontmatter = format.includes("frontmatter") || ["md", "mdx"].includes(extension);

  if (frontmatter) {
    if (format.includes("toml")) return null;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const { body, ...metadata } = data as ContentRecord;
    let header: string;
    if (format.startsWith("json")) header = JSON.stringify(metadata, null, 2);
    else header = stringifyYaml(metadata).trimEnd();
    const [start, end] = frontmatterDelimiters(definition);
    return `${start}\n${header}\n${end}\n${typeof body === "string" ? body : ""}\n`;
  }

  if (format === "json" || extension === "json") return `${JSON.stringify(data, null, 2)}\n`;
  if (format === "yaml" || extension === "yaml" || extension === "yml") return stringifyYaml(data);
  if (format === "raw" || format === "code" || format === "datagrid") {
    if (typeof data.content === "string") return data.content;
    return null;
  }

  if (["txt", "text", "raw", "code", "datagrid"].includes(format)) {
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && !Array.isArray(data) && typeof (data as ContentRecord).content === "string") {
      return (data as ContentRecord).content as string;
    }
  }

  return null;
}

function matchesExclude(path: string, root: string, patterns: unknown = []) {
  const relative = path.slice(root.length).replace(/^\//, "");
  const filename = relative.split("/").pop() || relative;
  if (!Array.isArray(patterns)) return false;
  return patterns.some((pattern) => {
    if (typeof pattern !== "string") return false;
    const escaped = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    const expression = new RegExp(`^${escaped}$`);
    return expression.test(relative) || expression.test(filename);
  });
}

async function collectFiles(
  context: RepositoryContext,
  definition: ContentDefinition,
  limit: number,
) {
  const root = safeRelativePath(definition.path || "");
  if (!root) return { files: [], error: "Configured content path is invalid.", truncated: false };
  if (definition.type === "file") return { files: [root], truncated: false };

  const files: string[] = [];
  const visitedDirectories = new Set<string>();
  let truncated = false;
  let failure: string | undefined;

  const walk = async (directory: string, depth: number): Promise<void> => {
    if (failure || files.length > limit || depth > 20 || visitedDirectories.size > 500) {
      truncated = files.length > limit || depth > 20 || visitedDirectories.size > 500;
      return;
    }
    if (visitedDirectories.has(directory)) return;
    visitedDirectories.add(directory);

    const result = await listRepositoryDirectory(context, directory);
    if (!result.ok) {
      if (result.message.includes("404")) return;
      failure = result.message;
      return;
    }

    for (const item of result.data) {
      if (item.type === "file" && item.path) {
        if (!matchesExclude(item.path, root, definition.exclude)) files.push(item.path);
        if (files.length > limit) {
          truncated = true;
          return;
        }
      } else if (item.type === "dir" && item.path && definition.subfolders !== false) {
        await walk(item.path, depth + 1);
        if (failure || truncated) return;
      }
    }
  };

  await walk(root, 0);
  if (failure) return { files, error: failure, truncated };
  return { files: files.slice(0, limit), truncated };
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        output[current] = await fn(items[current]);
      }
    }),
  );
  return output;
}

export async function listContentEntries(context: PagesContext, collectionName: string | undefined, limit: number) {
  const configuration = await loadConfiguration(context);
  if (!configuration.ok) return problem(configuration.code, configuration.message);
  const definition = findDefinition(configuration.data.entries, collectionName);
  if (!definition) return problem("COLLECTION_NOT_FOUND", `No configured collection named ${collectionName || "(missing)"}.`);

  const collected = await collectFiles(context, definition, limit);
  if (collected.error) return problem("CONTENT_LIST_FAILED", collected.error);

  const entries = await mapConcurrent(collected.files, 8, async (path) => {
    const file = await readRepositoryFile(context, path);
    if (!file.ok) return { path, collection: definition.name, title: path.split("/").pop() || path, data: { error: file.message } };
    const parsed = parseEntry(file.data.text, path, definition);
    return { path, collection: definition.name, title: parsed.title, data: parsed.data };
  });

  return {
    repository: context.repository,
    branch: context.branch || "default",
    collection: definition.name,
    count: entries.length,
    message: entries.length === 0 ? "0 items found" : `${entries.length} items found`,
    entries,
    truncated: collected.truncated,
    next_step: entries.length ? "Use content get to inspect an entry, or content update to edit one." : "Use content create to add the first entry.",
  };
}

export async function contentCommand(args: string[], inherited: PagesContext) {
  const parsed = parseArguments(args);
  if (parsed.error) return problem("INVALID_ARGUMENT", parsed.error);
  const context = resolvePagesContext(args, inherited);
  if (context.repositoryError) return problem("INVALID_REPOSITORY", context.repositoryError);
  if (!context.repository) {
    return problem("REPOSITORY_REQUIRED", "Pass --repo OWNER/REPO or set PAGESCMS_REPOSITORY.");
  }

  const [action] = parsed.positional;
  if (parsed.positional.length > 1) {
    return problem("INVALID_ARGUMENT", "Pass one content action: list, get, create, or update.");
  }
  if (!["list", "get", "create", "update"].includes(action || "")) {
    return problem("UNKNOWN_CONTENT_ACTION", "Choose list, get, create, or update.");
  }
  const collectionName = parsed.options.collection;

  if (action === "list") {
    const rawLimit = parsed.options.limit ? Number(parsed.options.limit) : DEFAULT_LIST_LIMIT;
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIST_LIMIT) {
      return problem("INVALID_LIMIT", `--limit must be an integer from 1 to ${MAX_LIST_LIMIT}.`);
    }
    return listContentEntries(context, collectionName, rawLimit);
  }

  const configuration = await loadConfiguration(context);
  if (!configuration.ok) return problem(configuration.code, configuration.message, ["Add a .pages.yml file to the repository root."]);

  const definition = findDefinition(configuration.data.entries, collectionName);
  if (!definition) return problem("COLLECTION_NOT_FOUND", `No configured collection named ${collectionName || "(missing)"}.`);

  const resolved = resolveEntryPath(definition, parsed.options.path);
  if (resolved.error) return problem("INVALID_PATH", resolved.error);
  if (!resolved.path || !isPathWithinRoot(resolved.path, safeRelativePath(definition.path || "") || "")) {
    return problem("INVALID_PATH", "Entry path must stay inside its configured content path.");
  }

  if (action === "get") {
    const file = await readRepositoryFile(context, resolved.path);
    if (!file.ok) return problem(file.code, file.message);
    const parsedEntry = parseEntry(file.data.text, resolved.path, definition);
    return {
      path: resolved.path,
      collection: definition.name,
      title: parsedEntry.title,
      data: parsedEntry.data,
      sha: file.data.sha,
    };
  }

  if (action === "create" || action === "update") {
    const rawData = parsed.options.data;
    if (!rawData) return problem("DATA_REQUIRED", "Pass --data with a JSON object.");
    let data: unknown;
    try {
      data = JSON.parse(rawData);
    } catch {
      return problem("INVALID_DATA", "--data must contain valid JSON.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return problem("INVALID_DATA", "--data must contain a JSON object.");
    }

    if (action === "create" && definition.type !== "collection") {
      return problem("CREATE_NOT_SUPPORTED", "Create is available for configured collections, not single-file entries.");
    }
    if (action === "create" && definition.operations?.create === false) {
      return problem("CREATE_DISABLED", `Creating entries is disabled for ${definition.name}.`);
    }
    if (action === "update" && definition.operations?.update === false) {
      return problem("UPDATE_DISABLED", `Updating entries is disabled for ${definition.name}.`);
    }

    const serialized = serializeEntry(data, resolved.path, definition);
    if (serialized === null) {
      return problem("UNSUPPORTED_FORMAT", "This content format is read-only. Supported writes: Markdown, JSON, YAML, and plain text.");
    }

    let sha: string | undefined;
    if (action === "update") {
      const current = await readRepositoryFile(context, resolved.path);
      if (!current.ok) return problem(current.code, current.message);
      sha = current.data.sha;
    }

    const commitMessage = parsed.options.message || `${action === "create" ? "Add" : "Update"} ${resolved.path}`;
    const written = await writeRepositoryFile(context, resolved.path, serialized, commitMessage, sha);
    if (!written.ok) return problem(written.code, written.message);
    return {
      ok: true,
      operation: action,
      repository: context.repository,
      branch: context.branch || "default",
      path: resolved.path,
      commit: written.data,
      next_step: `Use content get --collection ${definition.name} --path ${resolved.path} to confirm the entry.`,
    };
  }

  return problem("UNKNOWN_CONTENT_ACTION", "Choose list, get, create, or update.");
}
