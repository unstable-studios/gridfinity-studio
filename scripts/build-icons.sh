#!/usr/bin/env bash
# Rebuilds every app icon from build/icon-source.svg. Run it after changing the source and
# commit the results. Needs rsvg-convert (librsvg), magick (ImageMagick) and iconutil (macOS).
set -euo pipefail

cd "$(dirname "$0")/.."
src=build/icon-source.svg
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Windows and Linux: the tile fills the canvas.
mkdir -p build/icons
for size in 16 24 32 48 64 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" "$src" -o "build/icons/${size}x${size}.png"
done
magick build/icons/{16x16,24x24,32x32,48x48,64x64,128x128,256x256}.png build/icon.ico
cp build/icons/512x512.png resources/icon.png

# macOS: the tile sits inside the margin Apple's icon grid leaves (824 of 1024).
iconset="$tmp/icon.iconset"
mkdir "$iconset"
mac_png() {
  local size=$1 out=$2 inner=$(($1 * 824 / 1024))
  rsvg-convert -w "$inner" -h "$inner" "$src" -o "$tmp/inner.png"
  magick "$tmp/inner.png" -background none -gravity center -extent "${size}x${size}" "$out"
}
for size in 16 32 128 256 512; do
  mac_png "$size" "$iconset/icon_${size}x${size}.png"
  mac_png "$((size * 2))" "$iconset/icon_${size}x${size}@2x.png"
done
iconutil -c icns "$iconset" -o build/icon.icns
