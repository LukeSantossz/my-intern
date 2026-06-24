#!/usr/bin/env bash
# Tests for scripts/ensure-standards.sh.
#
# Verifies the .standards bootstrap contract from SPEC.md: populate when the
# sentinel is absent, no-op when present, graceful exit when every source
# fails, and use of the superproject's pinned commit. Plain bash, because no
# test framework is a project dependency. The fallback path runs against a
# local file:// tarball fixture so the suite stays deterministic and offline.
set -u

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_UNDER_TEST="$SCRIPT_DIR/ensure-standards.sh"
readonly PINNED_COMMIT="776a1b5a4aaa8fce299499b18f0fd806d461809a"
readonly SENTINEL_REL="docs/standards/INDEX.md"
readonly UNREACHABLE_BASE="file:///nonexistent/standards/tar.gz"

readonly TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

tests_run=0
tests_failed=0

report() { # $1 = 0 when the assertion held, non-zero otherwise; $2 = test name
  tests_run=$((tests_run + 1))
  if [ "$1" -eq 0 ]; then
    echo "ok   - $2"
  else
    echo "FAIL - $2"
    tests_failed=$((tests_failed + 1))
  fi
}

# Build a throwaway superproject whose .standards gitlink points at the pinned
# commit, with a deliberately unreachable submodule URL so the git path fails
# and the tarball fallback is exercised.
make_superproject() { # $1 = submodule url; echoes the worktree path
  local dir
  dir="$(mktemp -d "$TEST_ROOT/proj.XXXXXX")"
  git -C "$dir" init -q
  git -C "$dir" config user.email "test@example.com"
  git -C "$dir" config user.name "Test"
  printf '[submodule ".standards"]\n\tpath = .standards\n\turl = %s\n' "$1" > "$dir/.gitmodules"
  git -C "$dir" update-index --add --cacheinfo "160000,$PINNED_COMMIT,.standards"
  git -C "$dir" add .gitmodules
  git -C "$dir" commit -q -m "init"
  echo "$dir"
}

# Build a local tarball fixture named after the pinned commit so the fallback
# resolves offline, mirroring the <repo>-<ref>/ layout GitHub serves.
make_local_tarball_base() { # echoes a file:// base URL
  local base="$TEST_ROOT/tarballs"
  local root="$TEST_ROOT/tar-src/my-framework-$PINNED_COMMIT"
  mkdir -p "$root/docs/standards" "$base"
  printf 'INDEX\n' > "$root/$SENTINEL_REL"
  tar -czf "$base/$PINNED_COMMIT" -C "$TEST_ROOT/tar-src" "my-framework-$PINNED_COMMIT"
  printf 'file://%s' "$base"
}

# populates_standards_index_when_absent
proj="$(make_superproject "file:///nonexistent/my-framework.git")"
tarball_base="$(make_local_tarball_base)"
err="$(cd "$proj" && STANDARDS_TARBALL_BASE="$tarball_base" "$SCRIPT_UNDER_TEST" 2>&1 >/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && [ -f "$proj/.standards/$SENTINEL_REL" ]; then ok=0; else ok=1; fi
report "$ok" "populates_standards_index_when_absent"

# uses_pinned_commit_for_fallback (the same run must report the pinned commit)
if printf '%s' "$err" | grep -q "$PINNED_COMMIT"; then ok=0; else ok=1; fi
report "$ok" "uses_pinned_commit_for_fallback"

# is_noop_when_standards_present (empty stderr proves no fetch was attempted)
proj="$(make_superproject "file:///nonexistent/my-framework.git")"
mkdir -p "$proj/.standards/docs/standards"
printf 'PRESENT\n' > "$proj/.standards/$SENTINEL_REL"
err="$(cd "$proj" && STANDARDS_TARBALL_BASE="$UNREACHABLE_BASE" "$SCRIPT_UNDER_TEST" 2>&1 >/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && [ "$(cat "$proj/.standards/$SENTINEL_REL")" = "PRESENT" ] && [ -z "$err" ]; then ok=0; else ok=1; fi
report "$ok" "is_noop_when_standards_present"

# exits_zero_without_blocking_on_failure (both sources unreachable)
proj="$(make_superproject "file:///nonexistent/my-framework.git")"
err="$(cd "$proj" && STANDARDS_TARBALL_BASE="$UNREACHABLE_BASE" "$SCRIPT_UNDER_TEST" 2>&1 >/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && [ ! -f "$proj/.standards/$SENTINEL_REL" ] && printf '%s' "$err" | grep -qi "warning"; then ok=0; else ok=1; fi
report "$ok" "exits_zero_without_blocking_on_failure"

echo "---"
echo "$((tests_run - tests_failed))/$tests_run passed"
[ "$tests_failed" -eq 0 ]
