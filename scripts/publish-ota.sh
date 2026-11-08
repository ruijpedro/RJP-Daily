#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p 'require("./package.json").version')"
MIN_NATIVE="${RJP_MIN_NATIVE:-1.1.5}"
RELEASE_NOTES="${RJP_RELEASE_NOTES:-Melhorias e correções da RJP Daily}"
TAG="ota-v$VERSION"
ASSET="rjp-daily-web.zip"

echo "RJP Daily OTA $VERSION | APK base $MIN_NATIVE"
node scripts/verify-ota-native.mjs "$MIN_NATIVE"

# Na publicação automática não se publicam versões repetidas.
if [[ "${GITHUB_EVENT_NAME:-}" == "push" ]]; then
  PREVIOUS="$(git show HEAD^:package.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).version)}catch{}})' || true)"
  if [[ -n "$PREVIOUS" && "$PREVIOUS" == "$VERSION" ]]; then
    echo "Versão inalterada: nada a publicar."
    exit 0
  fi
fi

PRIVATE="$(gh api "repos/$GITHUB_REPOSITORY" --jq '.private')"
if [[ "$PRIVATE" != "false" ]]; then
  echo "::error::Para atualizações sem credenciais na APK, o repositório precisa de ser público."
  exit 1
fi
if gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  if [[ "${GITHUB_EVENT_NAME:-}" == "push" ]]; then
    echo "OTA $TAG já publicada; nada a fazer."
    exit 0
  fi
  echo "::error::Esta versão já está publicada. Incrementa a versão no package.json."
  exit 1
fi

npm install --no-audit --no-fund
npm test
npm run build
mkdir -p ota-release
# O plugin Capgo aceita um ZIP normal com index.html na raiz.
# Evita CLI de terceiros em versão flutuante e não requer API key.
(cd dist && zip -q -r -X ../ota-release/"$ASSET" .)
unzip -Z1 ota-release/"$ASSET" | grep -Fxq 'index.html' || {
  echo "::error::ZIP OTA inválido: index.html não está na raiz."; exit 1;
}
SHA="$(sha256sum ota-release/"$ASSET" | awk '{print $1}')"
cat > ota-release/notes.txt <<EOF
RJP Daily — Atualização OTA $VERSION

APP_ID: pt.rjp.daily
MIN_NATIVE_VERSION: $MIN_NATIVE
SHA256: $SHA

$RELEASE_NOTES

Atualiza apenas recursos web compatíveis. Os registos locais de
deslocações, prevenções, tarefas e notas não são enviados ao GitHub.
EOF

gh release create "$TAG" ota-release/"$ASSET" \
  --repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA" \
  --title "RJP Daily OTA $VERSION" --notes-file ota-release/notes.txt --latest

echo "OTA publicada: https://github.com/$GITHUB_REPOSITORY/releases/tag/$TAG"
