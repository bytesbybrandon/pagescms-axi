# Pages CMS AXI npm CI and Release

Status: Implemented and bootstrapped on npm.

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

npm trusted publishing is configured for `bytesbybrandon/pagescms-axi` and `npm-publish.yml` with direct publishing allowed.

The trusted publisher permits direct `npm publish` for this workflow.

## First publication

The user manually published `pagescms-axi@0.1.0` on 2026-09-28 after local package verification and release approval.

The npm `beta` and `latest` dist-tags currently both point to `0.1.0`.

The bootstrap used interactive npm account authentication with 2FA and no long-lived publish token.

Trusted publishing is configured before later GitHub Releases.

OIDC publishes from this public repository to a public npm package receive automatic provenance attestations.

The repository and npm package are public.

The manually published bootstrap version does not have an OIDC provenance attestation.

The next automated release must use a package version that has not already been published to npm.
