#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES_DIR="${ROOT_DIR}/images"
BUCKET_NAME="story-images"

if [[ ! -d "${IMAGES_DIR}" ]]; then
  echo "images/ folder not found: ${IMAGES_DIR}"
  exit 1
fi

found=0
while IFS= read -r -d '' file; do
  found=1
  rel="${file#${IMAGES_DIR}/}"
  echo "Uploading: ${rel}"
  wrangler r2 object put "${BUCKET_NAME}/${rel}" --file "${file}"
done < <(find "${IMAGES_DIR}" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) -print0)

if [[ "${found}" -eq 0 ]]; then
  echo "No image files found in ${IMAGES_DIR}"
fi

echo "Upload finished."
