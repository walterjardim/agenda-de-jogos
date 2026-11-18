#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} == --help || ${1:-} == -h ]]; then
    printf 'Uso: bash gerar-apk.sh [destino]\n'
    exit 0
fi
if (( $# > 1 )); then
    printf 'Uso: bash gerar-apk.sh [destino]\n' >&2
    exit 2
fi

raiz=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
origem="$raiz/frontend"
case "$OSTYPE" in
    msys*) destino_padrao=/c/Desenvolvimento/frontend ;;
    *) destino_padrao="$HOME/Desenvolvimento/frontend" ;;
esac
destino=${1:-$destino_padrao}

if [[ ! -f "$origem/android/gradlew" ]]; then
    printf 'Gradle wrapper não encontrado em %s/android.\n' "$origem" >&2
    exit 1
fi
if [[ -e "$destino" || -L "$destino" ]]; then
    printf 'O destino %s já existe. Escolha outro caminho ou renomeie a pasta.\n' "$destino" >&2
    exit 1
fi
command -v npm >/dev/null || { printf 'npm não encontrado no PATH.\n' >&2; exit 1; }
command -v tar >/dev/null || { printf 'tar não encontrado no PATH.\n' >&2; exit 1; }

pasta_pai=$(dirname -- "$destino")
mkdir -p -- "$pasta_pai"
pasta_pai=$(cd -- "$pasta_pai" && pwd -P)
case "$pasta_pai/" in
    "$origem/"*)
        printf 'Escolha um destino fora de %s.\n' "$origem" >&2
        exit 1
        ;;
esac
destino="$pasta_pai/$(basename -- "$destino")"
mkdir -- "$destino"

tar -C "$origem" --exclude=node_modules --exclude=.git --exclude=.gradle \
    --exclude=.cxx --exclude=.expo --exclude=build -cf - . |
    tar -C "$destino" -xf -

cd -- "$destino"
npm ci
bash android/gradlew -p android :app:assembleRelease -PreactNativeArchitectures=arm64-v8a

apk="$destino/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$apk" ]]; then
    printf 'O APK esperado não foi encontrado em %s.\n' "$apk" >&2
    exit 1
fi
printf 'APK gerado em %s\n' "$apk"
