#!/bin/sh
set -eu

echo "Running secret guard hook..."

if git diff --cached | grep -E "(ATLASSIAN_API_TOKEN|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})" >/dev/null 2>&1; then
  echo "ERROR: hardcoded secret detected in staged changes."
  echo "Use process.env and store secrets in .env."
  exit 1
fi

echo "Secret guard passed."
