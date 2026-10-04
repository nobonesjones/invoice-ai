#!/usr/bin/env bash
set -euo pipefail

echo "[iOS Reset] Selecting Xcode CLI tools..."
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode command line tools not found. Please install Xcode first." >&2
  exit 1
fi

sudo xcode-select -s /Applications/Xcode.app/Contents/Developer || true
echo "[iOS Reset] Xcode path: $(xcode-select -p)"

echo "[iOS Reset] Cleaning CocoaPods caches..."
rm -rf ios/Pods ios/Podfile.lock "$HOME/Library/Caches/CocoaPods" "$HOME/Library/Developer/Xcode/DerivedData"/* || true

# Prefer system CocoaPods when USE_SYSTEM_PODS=1 is set
if [ "${USE_SYSTEM_PODS:-}" = "1" ]; then
  echo "[iOS Reset] USE_SYSTEM_PODS=1 — using system CocoaPods..."
  if ! command -v pod >/dev/null 2>&1; then
    echo "CocoaPods not installed. Install via 'brew install cocoapods' (recommended) or 'sudo gem install cocoapods'" >&2
    exit 1
  fi
  set +e
  (cd ios && pod repo update && pod install --repo-update)
  status=$?
  set -e
  if [ $status -ne 0 ]; then
    echo "[iOS Reset] pod repo update failed. Attempting to repair CocoaPods specs repo..."
    rm -rf "$HOME/.cocoapods/repos/cocoapods" || true
    pod setup
    (cd ios && pod install)
  fi
else
  if command -v bundle >/dev/null 2>&1 && [ -f ios/Gemfile ]; then
    echo "[iOS Reset] Using Bundler to install CocoaPods..."
    set +e
    (
      cd ios || exit 1
      bundle install && bundle exec pod repo update && bundle exec pod install --repo-update
    )
    status=$?
    set -e
    if [ $status -ne 0 ]; then
      echo "[iOS Reset] Bundler path failed. Falling back to system CocoaPods..."
      if ! command -v pod >/dev/null 2>&1; then
        echo "CocoaPods not installed. Install via 'brew install cocoapods' (recommended) or 'sudo gem install cocoapods'" >&2
        exit 1
      fi
      set +e
      (cd ios && pod repo update && pod install --repo-update)
      status=$?
      set -e
      if [ $status -ne 0 ]; then
        echo "[iOS Reset] pod repo update failed. Attempting to repair CocoaPods specs repo..."
        rm -rf "$HOME/.cocoapods/repos/cocoapods" || true
        pod setup
        (cd ios && pod install)
      fi
    fi
  else
    echo "[iOS Reset] Using system CocoaPods..."
    if ! command -v pod >/dev/null 2>&1; then
      echo "CocoaPods not installed. Install via 'brew install cocoapods' (recommended) or 'sudo gem install cocoapods'" >&2
      exit 1
    fi
    set +e
    (cd ios && pod repo update && pod install --repo-update)
    status=$?
    set -e
    if [ $status -ne 0 ];
    then
      echo "[iOS Reset] pod repo update failed. Attempting to repair CocoaPods specs repo..."
      rm -rf "$HOME/.cocoapods/repos/cocoapods" || true
      pod setup
      (cd ios && pod install)
    fi
  fi
fi

echo "[iOS Reset] Done. You can now run: npm run ios"
