# Pages CMS AXI

Pages CMS AXI reads and updates content configured in `.pages.yml` files stored in GitHub repositories.

It uses the GitHub CLI (`gh`) for authenticated API access.

Content create and update operations commit changes to the selected repository.

## Requirements

Use Node.js 22.18 or later.

Install the GitHub CLI and authenticate with `gh auth login`.

The target repository must have a Pages CMS `.pages.yml` configuration.

## Run from a checkout

Run `npm ci` to install the locked dependencies.

Run `npm run axi -- --help` to show the command list.

Run `npm run axi -- collection list --repo OWNER/REPO` to list configured collections.

Run `npm run axi -- content list --repo OWNER/REPO --collection posts` to list entries in a collection.

Pass `--branch BRANCH` to select a branch.

You can set `PAGESCMS_REPOSITORY` and `PAGESCMS_BRANCH` to provide default target values.

## Install a local command

Run `npm link` from this repository to link the checkout into npm's global command directory.

Then run `pagescms-axi --help` or `pagescms-axi collection list --repo OWNER/REPO` from any directory.

The local link uses this checkout and does not require an npm-published package.

## Development

Run `npm run build` to type-check the source and verify the generated skill pointer.

Run `npm test` to execute the local test suite.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and verification steps.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

See [LICENSE](LICENSE) for license terms.
