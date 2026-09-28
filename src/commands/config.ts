import { type PagesContext, parseArguments, resolvePagesContext } from "../context.ts";
import { loadConfiguration } from "../pages.ts";

function problem(code: string, error: string, help: string[] = []) {
  return { error, code, ...(help.length ? { help } : {}) };
}

export async function configCommand(args: string[], inherited: PagesContext) {
  const parsed = parseArguments(args);
  if (parsed.error) return problem("INVALID_ARGUMENT", parsed.error);
  if (parsed.positional.length > 1 || (parsed.positional[0] && parsed.positional[0] !== "show")) {
    return problem("UNKNOWN_CONFIG_ACTION", "Choose config or config show.");
  }

  const context = resolvePagesContext(args, inherited);
  if (context.repositoryError) return problem("INVALID_REPOSITORY", context.repositoryError);
  if (!context.repository) return problem("REPOSITORY_REQUIRED", "Pass --repo OWNER/REPO or set PAGESCMS_REPOSITORY.");

  const result = await loadConfiguration(context);
  if (!result.ok) return problem(result.code, result.message, ["Add a .pages.yml file to the repository root."]);

  return {
    repository: context.repository,
    branch: context.branch || "default",
    path: ".pages.yml",
    config: result.data.config,
    next_step: "Run collection list to see editable collections and files.",
  };
}

export async function collectionCommand(args: string[], inherited: PagesContext) {
  const parsed = parseArguments(args);
  if (parsed.error) return problem("INVALID_ARGUMENT", parsed.error);
  const [action] = parsed.positional;
  if (action !== "list" || parsed.positional.length > 1) {
    return problem("UNKNOWN_COLLECTION_ACTION", "Choose collection list.");
  }

  const context = resolvePagesContext(args, inherited);
  if (context.repositoryError) return problem("INVALID_REPOSITORY", context.repositoryError);
  if (!context.repository) return problem("REPOSITORY_REQUIRED", "Pass --repo OWNER/REPO or set PAGESCMS_REPOSITORY.");

  const result = await loadConfiguration(context);
  if (!result.ok) return problem(result.code, result.message, ["Add a .pages.yml file to the repository root."]);

  const collections = result.data.entries.map((entry) => ({
    name: entry.name,
    label: entry.label || entry.name,
    type: entry.type,
    path: entry.path,
  }));

  return {
    repository: context.repository,
    branch: context.branch || "default",
    count: collections.length,
    message: collections.length === 0 ? "0 items found" : `${collections.length} items found`,
    collections,
    next_step: collections.length
      ? `Run content list --collection ${collections[0].name} to inspect entries.`
      : "Add a collection or file under content in .pages.yml.",
  };
}
