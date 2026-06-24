#!/usr/bin/env bash
# Ensure the .standards submodule content is present before work begins.
#
# Why: in Claude Code on the web, the session's scoped git credential cannot
# clone the separate my-framework repository (HTTP 403), so a plain
# `git submodule update` leaves .standards empty and the binding development
# standards unavailable. This script first tries the normal submodule init and,
# when that fails, falls back to the exact pinned commit's public tarball over
# the network-allowlisted codeload.github.com domain. It is idempotent and
# never blocks the session (always exits 0).
#
# Wired as a SessionStart hook in .claude/settings.json; safe to run by hand.
# STANDARDS_TARBALL_BASE overrides the tarball source (mirrors and offline tests).
set -u

readonly SUBMODULE_PATH=".standards"
readonly SENTINEL_REL="docs/standards/INDEX.md"
readonly TARBALL_BASE="${STANDARDS_TARBALL_BASE:-https://codeload.github.com/LukeSantossz/my-framework/tar.gz}"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo_root" || exit 0

sentinel="$SUBMODULE_PATH/$SENTINEL_REL"

# Idempotent: nothing to do when the standards are already materialized.
[ -f "$sentinel" ] && exit 0

# Preferred path: a real submodule checkout, which works wherever the git
# credential is allowed to reach the source repository.
if git submodule update --init --recursive "$SUBMODULE_PATH" >/dev/null 2>&1 && [ -f "$sentinel" ]; then
  echo "ensure-standards: initialized $SUBMODULE_PATH via git submodule" >&2
  exit 0
fi

# Fallback: fetch the exact commit the superproject pins, not a moving branch.
pinned_commit="$(git ls-tree HEAD "$SUBMODULE_PATH" 2>/dev/null | awk '$2 == "commit" { print $3 }')"
if [ -z "$pinned_commit" ]; then
  echo "ensure-standards: WARNING no pinned commit recorded for $SUBMODULE_PATH; standards unavailable" >&2
  exit 0
fi

tmp_dir="$(mktemp -d)" || exit 0
trap 'rm -rf "$tmp_dir"' EXIT

if ! curl -fsSL "$TARBALL_BASE/$pinned_commit" -o "$tmp_dir/standards.tar.gz" 2>/dev/null; then
  echo "ensure-standards: WARNING could not fetch $SUBMODULE_PATH tarball @ $pinned_commit; standards unavailable" >&2
  exit 0
fi

if ! tar -xzf "$tmp_dir/standards.tar.gz" -C "$tmp_dir" 2>/dev/null; then
  echo "ensure-standards: WARNING could not extract $SUBMODULE_PATH tarball @ $pinned_commit; standards unavailable" >&2
  exit 0
fi

# GitHub serves a single top-level directory named <repo>-<ref>.
extracted_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d -name 'my-framework-*' | head -n 1)"
if [ -z "$extracted_dir" ] || [ ! -f "$extracted_dir/$SENTINEL_REL" ]; then
  echo "ensure-standards: WARNING unexpected tarball layout for $SUBMODULE_PATH @ $pinned_commit; standards unavailable" >&2
  exit 0
fi

mkdir -p "$SUBMODULE_PATH"
cp -a "$extracted_dir/." "$SUBMODULE_PATH/"
echo "ensure-standards: populated $SUBMODULE_PATH from public tarball @ $pinned_commit" >&2
exit 0
