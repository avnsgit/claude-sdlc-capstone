#!/bin/sh
set -eu

echo "Verifying SDLC documentation integrity..."

REQUIRED_FILES="requirements.md architecture.md design-review.md impl-plan.md"

for file in $REQUIRED_FILES; do
  if [ ! -f "$file" ]; then
    echo "MISSING DOC: $file is required before running Playwright tests."
    exit 1
  fi
done

echo "All required SDLC document files are present."
