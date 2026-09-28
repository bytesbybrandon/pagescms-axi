# Pages CMS AXI npm CI and Release

Status: Implemented, pending local verification.

Package: `pagescms-axi`.

Current package version: `0.1.0`.

## Continuous integration

Pull requests and pushes to `main` run on Node.js 22.18.x and 24.x.

CI runs `npm ci`, `npm test`, `npm audit --audit-level=high`, and `npm run verify:package`.

The package check compiles JavaScript runtime files, enforces an exact tarball allowlist, installs the tarball into a temporary consumer, and checks the installed CLI version and help.

## Release workflow

Publishing runs only from a published GitHub Release whose tag exactly matches the package version.

GitHub prereleases publish to npm's `beta` tag, and stable releases publish to `latest`.

The workflow reruns CI, packs and checks the exact tarball, and publishes with npm trusted publishing through GitHub Actions OIDC.

The workflow has `id-token: write` only in the publish job and uses no long-lived npm token.

Configure npm trusted publishing for `bytesbybrandon/pagescms-axi` and `npm-publish.yml` after the package exists.

Enable direct `npm publish` as an allowed action in the trusted publisher settings.

## First publication

The first version must be published manually after the local package check and separate release approval.

Use interactive npm account authentication with 2FA and do not create a long-lived publish token.

After the package exists, configure trusted publishing before creating later GitHub Releases.

OIDC publishes from this public repository to a public npm package receive automatic provenance attestations.

The current repository is public, and no npm release has been approved in this plan.
