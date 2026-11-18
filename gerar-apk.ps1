param(
    [string]$Destino = (Join-Path 'C:\aj-apk' (Get-Date -Format 'yyyyMMdd-HHmmss'))
)

$ErrorActionPreference = 'Stop'

$origem = Join-Path $PSScriptRoot 'frontend'
$destino = [System.IO.Path]::GetFullPath($Destino)
$commit = git -C $PSScriptRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel identificar o commit de origem.' }
Write-Host "Origem: $origem"
Write-Host "Commit: $commit (inclui alteracoes locais, se houver)"
Write-Host "Pasta nova de build: $destino"

if (-not (Test-Path -LiteralPath (Join-Path $origem 'android\gradlew.bat') -PathType Leaf)) {
    throw "Gradle wrapper nao encontrado em $origem\android."
}
if (Test-Path -LiteralPath $destino) {
    throw "O destino $destino ja existe. Renomeie a pasta antes de executar o script novamente."
}

Get-Command npm.cmd -ErrorAction Stop | Out-Null

robocopy.exe $origem $destino /E /XD node_modules .git .gradle .cxx .expo build /R:1 /W:1
if ($LASTEXITCODE -ge 8) {
    throw "Falha ao copiar o frontend (Robocopy: $LASTEXITCODE)."
}

Push-Location -LiteralPath $destino
try {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no npm ci (codigo: $LASTEXITCODE)."
    }

    .\android\gradlew.bat -p android :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a'
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no build Gradle (codigo: $LASTEXITCODE)."
    }

    $apk = Join-Path $destino 'android\app\build\outputs\apk\release\app-release.apk'
    if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) {
        throw "O APK esperado nao foi encontrado em $apk."
    }
    $nomeApk = "Agenda-de-Jogos-$(Get-Date -Format 'yyyyMMdd-HHmmss').apk"
    Rename-Item -LiteralPath $apk -NewName $nomeApk
    $apk = Join-Path (Split-Path -Parent $apk) $nomeApk
    @{
        source = $origem
        commit = $commit
        builtAt = (Get-Date).ToString('o')
        apk = $apk
        sha256 = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
    } | ConvertTo-Json | Set-Content -LiteralPath "$apk.json" -Encoding utf8
    Write-Host "APK gerado em $apk"
}
finally {
    Pop-Location
}
