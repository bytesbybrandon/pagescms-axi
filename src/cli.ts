import { runAxiCli } from "axi-sdk-js";
import { collectionCommand, configCommand } from "./commands/config.ts";
import { home } from "./commands/home.ts";
import { contentCommand } from "./content.ts";
import { resolvePagesContext } from "./context.ts";
import { VERSION } from "./version.ts";

export async function main() {
  await runAxiCli({
    description: "Inspect and manage Pages CMS content stored in GitHub repositories.",
    version: VERSION,
    packageName: "pagescms-axi",
    argv: process.argv.slice(2),
    topLevelHelp: [
      "Pages CMS AXI",
      "Commands: config, collection, content",
      "Examples:",
      "  pagescms-axi collection list --repo OWNER/REPO",
      "  pagescms-axi content list --repo OWNER/REPO --collection posts",
      "  pagescms-axi content get --repo OWNER/REPO --collection posts --path hello.md",
      "Set PAGESCMS_REPOSITORY and PAGESCMS_BRANCH to configure defaults.",
    ].join("\n"),
    commands: {
      config: configCommand,
      collection: collectionCommand,
      content: contentCommand,
    },
    home,
    resolveContext({ args }) {
      return resolvePagesContext(args);
    },
    getCommandHelp(command) {
      if (command === "config") return "Read the .pages.yml configuration from the selected repository.";
      if (command === "collection") return "Use `collection list` to list configured collections and single files.";
      if (command === "content") return "Use list, get, create, or update with --collection and --repo.";
      return undefined;
    },
  });
}
