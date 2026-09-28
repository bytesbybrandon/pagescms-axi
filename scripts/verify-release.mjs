import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  throw new Error("GITHUB_EVENT_PATH is required to validate a published GitHub Release.");
}

const event = JSON.parse(await readFile(eventPath, "utf8"));
const release = event.release;
const version = packageJson.version;
const tag = release?.tag_name;
const isPrereleaseVersion = version.split("+", 1)[0].includes("-");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json version is not a valid three-part SemVer version: ${version}`);
}

if (packageLock.packages?.[""]?.version !== version) {
  throw new Error("package.json and package-lock.json versions must match.");
}

if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} must exactly match package version v${version}.`);
}

if (Boolean(release.prerelease) !== isPrereleaseVersion) {
  throw new Error("GitHub Release prerelease status must match the package SemVer prerelease version.");
}

const npmTag = isPrereleaseVersion ? "beta" : "latest";

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `npm_tag=${npmTag}\n`);
}

console.log(`Release ${tag} validated for npm dist-tag ${npmTag}.`);
