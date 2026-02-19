#!/usr/bin/env bash
# CI tests for murfalo.github.io — run from repo root: bash tests/ci.sh
set -eo pipefail

cd "$(dirname "$0")/.."

PASS=0
FAIL=0
ERRORS=()

pass() { PASS=$((PASS + 1)); printf "  ✓ %s\n" "$1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+=("$1"); printf "  ✗ %s\n" "$1"; }

# ─── 1. Asset existence ───────────────────────────────────────────
echo "Asset existence"

# Local paths from index.html (href/src, excluding external URLs, mailto, bare anchors)
HTML_PATHS=()
while IFS= read -r p; do
  [[ -n "$p" ]] && HTML_PATHS+=("$p")
done < <(
  grep -oE '(href|src)="[^"]*"' index.html \
    | sed -E 's/(href|src)="([^"]*)"/\2/' \
    | grep -vE '^(https?://|mailto:|#)' \
    | sed 's|^/||' \
    || true
)

# Icon paths from webmanifest
MANIFEST_PATHS=()
while IFS= read -r p; do
  [[ -n "$p" ]] && MANIFEST_PATHS+=("$p")
done < <(
  python3 -c "
import json
d = json.load(open('site.webmanifest'))
for icon in d.get('icons', []):
    print(icon['src'].lstrip('/'))
"
)

ALL_PATHS=("${HTML_PATHS[@]}" "${MANIFEST_PATHS[@]}")

for path in "${ALL_PATHS[@]}"; do
  if [[ -f "$path" ]]; then
    pass "$path exists"
  else
    fail "$path missing"
  fi
done

# ─── 2. HTML structure ────────────────────────────────────────────
echo ""
echo "HTML structure"

check_html() {
  local pattern="$1" label="$2"
  if grep -qiE "$pattern" index.html; then
    pass "$label"
  else
    fail "$label"
  fi
}

check_html '<!DOCTYPE html>' 'DOCTYPE declaration'
check_html '<html' '<html> tag'
check_html '<head>' '<head> tag'
check_html '</head>' '</head> tag'
check_html '<body>' '<body> tag'
check_html '</body>' '</body> tag'
check_html '</html>' '</html> tag'
check_html '<title>' '<title> tag'
check_html 'meta.*charset' 'charset meta'
check_html 'meta.*viewport' 'viewport meta'

STYLE_OPEN=$(grep -c '<style>' index.html || true)
STYLE_CLOSE=$(grep -c '</style>' index.html || true)
if [[ "$STYLE_OPEN" -gt 0 && "$STYLE_OPEN" -eq "$STYLE_CLOSE" ]]; then
  pass "<style> tags matched ($STYLE_OPEN)"
else
  fail "<style> tags mismatched ($STYLE_OPEN open, $STYLE_CLOSE close)"
fi

SCRIPT_OPEN=$(grep -c '<script>' index.html || true)
SCRIPT_CLOSE=$(grep -c '</script>' index.html || true)
if [[ "$SCRIPT_OPEN" -gt 0 && "$SCRIPT_OPEN" -eq "$SCRIPT_CLOSE" ]]; then
  pass "<script> tags matched ($SCRIPT_OPEN)"
else
  fail "<script> tags mismatched ($SCRIPT_OPEN open, $SCRIPT_CLOSE close)"
fi

# ─── 3. Webmanifest validity ──────────────────────────────────────
echo ""
echo "Webmanifest validity"

MANIFEST_ERRORS=$(python3 -c "
import json, sys
try:
    d = json.load(open('site.webmanifest'))
except Exception as e:
    print(f'invalid JSON: {e}')
    sys.exit(0)
required = ['name', 'icons', 'theme_color', 'background_color', 'display']
for f in required:
    if f not in d:
        print(f'missing field: {f}')
for i, icon in enumerate(d.get('icons', [])):
    for f in ['src', 'sizes', 'type']:
        if f not in icon:
            print(f'icon {i} missing: {f}')
")

if [[ -z "$MANIFEST_ERRORS" ]]; then
  pass "site.webmanifest valid with all required fields"
else
  while IFS= read -r line; do
    fail "webmanifest: $line"
  done <<< "$MANIFEST_ERRORS"
fi

# ─── 4. Fragment references ───────────────────────────────────────
echo ""
echo "Fragment references"

# url(#...) references (e.g. SVG filters)
FRAGMENTS=()
while IFS= read -r f; do
  [[ -n "$f" ]] && FRAGMENTS+=("$f")
done < <(
  grep -oE 'url\(#[^)]+\)' index.html \
    | sed -E 's/url\(#([^)]+)\)/\1/' \
    | sort -u \
    || true
)

# href="#..." references (excluding bare #)
while IFS= read -r f; do
  [[ -n "$f" ]] && FRAGMENTS+=("$f")
done < <(
  grep -oE 'href="#[^"]+' index.html \
    | sed 's/href="#//' \
    | sort -u \
    || true
)

for frag in "${FRAGMENTS[@]}"; do
  if grep -q "id=\"$frag\"" index.html; then
    pass "#$frag has matching id"
  else
    fail "#$frag has no matching id"
  fi
done

# ─── 5. Image integrity ──────────────────────────────────────────
echo ""
echo "Image integrity"

for png in img/*.png; do
  [[ -f "$png" ]] || continue
  if file -b "$png" | grep -q "PNG image"; then
    pass "$png valid PNG"
  else
    fail "$png not a valid PNG ($(file -b "$png"))"
  fi
done

if [[ -f img/favicon.ico ]]; then
  if file -b img/favicon.ico | grep -qi "icon"; then
    pass "img/favicon.ico valid ICO"
  else
    fail "img/favicon.ico not a valid ICO ($(file -b img/favicon.ico))"
  fi
fi

# ─── 6. Merge conflict markers ───────────────────────────────────
echo ""
echo "Merge conflict markers"

for f in index.html site.webmanifest; do
  if grep -qE '^(<{7}|={7}|>{7})' "$f"; then
    fail "$f contains merge conflict markers"
  else
    pass "$f clean"
  fi
done

# ─── 7. Asset list freshness ─────────────────────────────────────
echo ""
echo "Asset list freshness"

KNOWN_ASSETS=(
  img/favicon.ico
  img/favicon-16x16.png
  img/favicon-32x32.png
  img/apple-touch-icon.png
  img/murfalo.png
  img/android-chrome-192x192.png
  img/android-chrome-512x512.png
  site.webmanifest
)

EXTRACTED=()
while IFS= read -r p; do
  [[ -n "$p" ]] && EXTRACTED+=("$p")
done < <(printf '%s\n' "${ALL_PATHS[@]}" | sort -u)

for path in "${EXTRACTED[@]}"; do
  found=false
  for known in "${KNOWN_ASSETS[@]}"; do
    if [[ "$path" == "$known" ]]; then
      found=true
      break
    fi
  done
  if $found; then
    pass "$path tracked"
  else
    fail "$path not in KNOWN_ASSETS — update tests/ci.sh"
  fi
done

# ─── Summary ──────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "%s passed, %s failed\n" "$PASS" "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
