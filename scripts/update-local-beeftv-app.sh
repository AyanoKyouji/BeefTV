#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGED_APP="$ROOT_DIR/backend/cmd/desktop/build/bin/YUNTV.app"
INSTALLED_APP="/Applications/YUNTV.app"
LEGACY_APP="/Applications/BeefTV.app"

cleanup_staged_app() {
  if [[ -d "$STAGED_APP" && ! -L "$STAGED_APP" ]]; then
    find "$STAGED_APP" -depth -delete
  fi
}
trap cleanup_staged_app EXIT

quit_installed_app() {
  osascript -e 'tell application id "com.wails.beeftv" to quit' 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    pgrep -f '^/Applications/(BeefTV|YUNTV)\.app/Contents/MacOS/(BeefTV|YUNTV)$' >/dev/null || break
    sleep 1
  done
  if pgrep -f '^/Applications/(BeefTV|YUNTV)\.app/Contents/MacOS/(BeefTV|YUNTV)$' >/dev/null; then
    echo "YUNTV is still running. Save your work and quit before updating." >&2
    exit 1
  fi
}

# Wails binding generation starts the desktop composition root too, so the
# installed process must release the data-directory lock before building.
quit_installed_app
RUNTIME_APP="$INSTALLED_APP"
[[ -d "$RUNTIME_APP" ]] || RUNTIME_APP="$LEGACY_APP"
if [[ -d "$RUNTIME_APP/Contents/Resources/agent-host/media-runtime" ]] && codesign --verify --deep --strict "$RUNTIME_APP"; then
  export BEEFTV_MEDIA_RUNTIME_DIR="$RUNTIME_APP/Contents/Resources/agent-host/media-runtime"
fi
"$ROOT_DIR/scripts/build-beeftv-release.sh"

if [[ ! -x "$STAGED_APP/Contents/MacOS/YUNTV" ]]; then
  echo "Built YUNTV.app is incomplete: $STAGED_APP" >&2
  exit 1
fi
# External agents connect through the bundled CLI, so an install without it is
# incomplete even though the GUI would start.
if [[ ! -x "$STAGED_APP/Contents/MacOS/cli/yuntv" ]]; then
  echo "Built YUNTV.app has no bundled yuntv CLI: $STAGED_APP/Contents/MacOS/cli/yuntv" >&2
  exit 1
fi
codesign --verify --deep --strict "$STAGED_APP"
if [[ -e "$INSTALLED_APP" && ( ! -d "$INSTALLED_APP" || -L "$INSTALLED_APP" ) ]]; then
  echo "Refusing to replace unexpected target: $INSTALLED_APP" >&2
  exit 1
fi

quit_installed_app

if [[ -e "$LEGACY_APP" ]]; then
  if [[ ! -d "$LEGACY_APP" || -L "$LEGACY_APP" || -e "$INSTALLED_APP" ]]; then
    echo "Both app names exist or the legacy app is unexpected; resolve the duplicate before updating." >&2
    exit 1
  fi
  # Rename the existing installation only after the new signed build is ready.
  mv "$LEGACY_APP" "$INSTALLED_APP"
fi
mkdir -p "$INSTALLED_APP"
rsync -a --delete "$STAGED_APP/" "$INSTALLED_APP/"
codesign --verify --deep --strict "$INSTALLED_APP"

echo "Updated the canonical local app: $INSTALLED_APP"
