import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSkillMarkdown } from "../src/skill.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "skills", "Pages CMS AXI-axi", "SKILL.md");
const expected = createSkillMarkdown();
const checkOnly = process.argv.includes("--check");

let current: string | null = null;
try {
  current = await readFile(outputPath, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

if (checkOnly) {
  if (current === expected) {
    process.stdout.write("Skill pointer is in sync.\n");
  } else {
    process.stderr.write("Skill pointer is missing or has drifted. Run npm run build:skill.\n");
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected, "utf8");
  process.stdout.write(`Wrote ${outputPath}\n`);
}
