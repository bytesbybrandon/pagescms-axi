import { type PagesContext } from "../context.ts";
import { loadConfiguration } from "../pages.ts";

export async function home(_args: string[], context: PagesContext) {
  if (context.repositoryError) {
    return {
      service: "Pages CMS",
      status: "invalid_repository",
      repository: null,
      collections: [],
      count: 0,
      message: "0 items found",
      next_step: context.repositoryError,
    };
  }

  if (!context.repository) {
    return {
      service: "Pages CMS",
      status: "needs_repository",
      repository: null,
      branch: context.branch || "default",
      collections: [],
      count: 0,
      message: "0 items found",
      next_step: "Set PAGESCMS_REPOSITORY=OWNER/REPO or pass --repo OWNER/REPO.",
      help: [
        "Run `pagescms-axi collection list --repo OWNER/REPO` to inspect configured content.",
        "Run `pagescms-axi content list --repo OWNER/REPO --collection NAME` to list entries.",
      ],
    };
  }

  const config = await loadConfiguration(context);
  if (!config.ok) {
    const missingConfig = config.code === "PAGES_CONFIG_NOT_FOUND";
    return {
      service: "Pages CMS",
      status: missingConfig ? "not_configured" : "unavailable",
      repository: context.repository,
      branch: context.branch || "default",
      collections: [],
      count: 0,
      message: "0 items found",
      error: config.message,
      next_step: missingConfig
        ? "Add .pages.yml to the repository root, then rerun pagescms-axi."
        : "Check gh authentication and the repository name, then rerun pagescms-axi.",
    };
  }

  const collections = config.data.entries.map((entry) => ({
    name: entry.name,
    label: entry.label || entry.name,
    type: entry.type,
    path: entry.path,
  }));

  return {
    service: "Pages CMS",
    status: "connected",
    repository: context.repository,
    branch: context.branch || "default",
    collections,
    count: collections.length,
    message: collections.length === 0 ? "0 items found" : `${collections.length} items found`,
    next_step: collections.length
      ? `Run pagescms-axi content list --collection ${collections[0].name} to inspect entries.`
      : "Add a collection or file under content in .pages.yml.",
  };
}
