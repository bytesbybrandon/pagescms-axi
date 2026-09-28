# Pages CMS AXI Manual Verification

Run these checks from the project directory with Node.js 22.18 or later.

## Build and automated checks

- Run `npm ci` and confirm installation completes without errors.
- Run `npm test` and confirm the local suite passes without GitHub credentials or network access.
- Run `npm run build:skill -- --check` and confirm the skill pointer is current.

## Packaged CLI local check

- Run `npm run verify:package -- --keep` and confirm the package allowlist and installed CLI version and help checks pass.
- Confirm the tarball is written to `dist/pagescms-axi-0.1.0.tgz`.
- In PowerShell, install that tarball into a temporary directory and run the installed command.

```powershell
$testRoot = Join-Path $env:TEMP ("pagescms-axi-local-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot | Out-Null
$tarball = Get-Item .\dist\pagescms-axi-0.1.0.tgz
npm install --ignore-scripts --prefix $testRoot $tarball.FullName
$axi = Join-Path $testRoot "node_modules\.bin\pagescms-axi.cmd"
& $axi --version
& $axi --help
```

- Confirm the command prints `0.1.0` and help without contacting GitHub.
- If you run an integration check, use a read-only command such as `collection list` against a selected repository.
- Do not use `content create` or `content update` during the package check.
- Complete and review the local package check before the first npm publication.
