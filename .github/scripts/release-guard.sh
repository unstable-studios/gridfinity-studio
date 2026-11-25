#!/usr/bin/env bash
# Fails unless a release commit changes only what a release should: the version in
# package.json, the changelog and the release manifest.
#
# Release Please writes its commit from copies of the files it read earlier. If something
# merged in between, the stale copy undoes it. That is how the 1.18.0 release put back
# removed packages and broke every install.
#
# Usage: release-guard.sh <base> <head>, both git revisions. The two are compared directly,
# so a release branch that is behind its base also fails, until it is rebuilt.
set -euo pipefail

base=$1
head=$2

allowed='package\.json|CHANGELOG\.md|\.release-please-manifest\.json'
unexpected=$(git diff --name-only "$base" "$head" | grep -vxE "$allowed" || true)
if [ -n "$unexpected" ]; then
  echo "::error::The release changes files a release should not touch:"
  echo "$unexpected"
  exit 1
fi

version_line='^[-+][[:space:]]*"version": "[0-9]+\.[0-9]+\.[0-9]+[^"]*",$'
other_lines=$(
  git diff --unified=0 "$base" "$head" -- package.json |
    grep -E '^[-+]' | grep -vE '^(---|\+\+\+) ' | grep -vE "$version_line" || true
)
if [ -n "$other_lines" ]; then
  echo "::error::The release changes more than the version in package.json:"
  echo "$other_lines"
  exit 1
fi

echo "The release changes only the version, the changelog and the manifest."
