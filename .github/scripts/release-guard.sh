#!/usr/bin/env bash
# Fails unless a release commit changes only what a release should: the version in
# package.json, the changelog and the release manifest.
#
# Release Please writes its commit from copies of the files it read earlier. If something
# merged in between, the stale copy undoes it. That is how the 1.18.0 release put back
# removed packages and broke every install.
#
# Usage: release-guard.sh <base> <head>, both git revisions. The head is compared with the
# commit it branched from, which is what a merge applies. A release branch that is only
# behind its base passes: merging it brings in nothing but its own changes.
set -euo pipefail

head=$2
base=$(git merge-base "$1" "$head") || {
  echo "::error::No common ancestor between $1 and $head"
  exit 1
}

allowed='package\.json|CHANGELOG\.md|\.release-please-manifest\.json'
unexpected=$(git diff --name-only "$base" "$head" | grep -vxE "$allowed" || true)
if [ -n "$unexpected" ]; then
  echo "::error::The release changes files a release should not touch:"
  echo "$unexpected"
  exit 1
fi

version_line='^[-+][[:space:]]*"version": "[0-9]+\.[0-9]+\.[0-9]+[^"]*",?[[:space:]]*$'
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
