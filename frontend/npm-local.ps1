# Usa o npm distribuído com o Node, sem alterar a instalação global.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArguments)
$frontendNodePath = (Get-Command node.exe -ErrorAction Stop).Source
$frontendNpmCli = Join-Path (Split-Path $frontendNodePath) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $frontendNpmCli)) {
  throw 'O npm não foi encontrado junto ao Node.js. Reinstale o Node.js LTS com npm.'
}
& $frontendNodePath $frontendNpmCli @NpmArguments
exit $LASTEXITCODE

