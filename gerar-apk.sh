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
    msys*) destino_padrao="/c/aj-apk/$(date +%Y%m%d-%H%M%S)" ;;
    *) destino_padrao="/C/Desenvolvimento/apk" ;;
esac
destino=${1:-$destino_padrao}

if [[ ! -f "$origem/android/gradlew" ]]; then
    printf 'Gradle wrapper não encontrado em %s/android.\n' "$origem" >&2
    exit 1
fi
if [[ -e "$destino" || -L "$destino" ]]; then
    rm -rf "$destino"
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

gradle_log=$(mktemp)
trap 'rm -f -- "$gradle_log"' EXIT
gradle_args=(-p android :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain)

if bash android/gradlew "${gradle_args[@]}" 2>&1 | tee "$gradle_log"; then
    :
else
    gradle_status=$?
    if ! grep -Eq 'foojay-resolver-convention.*was not found|could not resolve plugin artifact.*foojay-resolver-convention' "$gradle_log"; then
        exit "$gradle_status"
    fi
    printf 'O Gradle não conseguiu resolver o plugin Foojay. Tentando novamente em 15 segundos.\n' >&2
    sleep 15
    bash android/gradlew "${gradle_args[@]}" --refresh-dependencies
fi

apk="$destino/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$apk" ]]; then
    printf 'O APK esperado não foi encontrado em %s.\n' "$apk" >&2
    exit 1
fi
nome_apk="Agenda-de-Jogos-$(date +%Y%m%d-%H%M%S).apk"
apk_final="$(dirname -- "$apk")/$nome_apk"
mv -- "$apk" "$apk_final"
apk="$apk_final"
printf 'APK gerado em %s\n' "$apk"
