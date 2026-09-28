# Contributing

Thanks for helping improve Pages CMS AXI.

## Development setup

Use Node.js 22.18 or later.

Run `npm ci` to install the locked dependencies.

Run `npm run build` to type-check the source and verify the generated skill pointer.

Run `npm test` to run the local suite.

The automated suite does not require GitHub credentials or network access.

## Change guidelines

Add or update tests for behavior changes.

Keep repository path validation in place before making GitHub API calls or writing content.

Update the README when command behavior or requirements change.

Do not commit local environment files, credentials, generated workspace state, or temporary package archives.

## Pull requests

Open a pull request with a concise summary of the change and its motivation.

Include the verification commands you ran and any relevant results.

Call out behavior changes, compatibility concerns, and follow-up work.
