# SPEC: chore(standards): bootstrap .standards submodule with public-tarball fallback

## Problem

In Claude Code on the web sessions, the `.standards` submodule fails to initialize because the session's scoped git credential cannot clone the separate `LukeSantossz/my-framework` repository (HTTP 403), leaving the project's binding development standards unavailable.

## Design Decision

Add a `SessionStart` hook, committed to this repository, that runs an idempotent bootstrap script. The script first attempts the normal `git submodule update --init` for `.standards`; if that fails (for example, the credential-scope 403 above), it falls back to fetching the pinned submodule commit as a tarball from the public source repository over the network-allowlisted `codeload.github.com` domain and materializes it into `.standards/`. The hook is a no-op when the standards are already present and never blocks the session (always exits 0).

## Alternatives Considered

1. Reconfigure the cloud environment / recreate the session with `my-framework` in scope. Rejected: the GitHub proxy scopes git credentials per session, independently of the Network access level, so this is not reproducible from the repository and cannot be guaranteed for every contributor or future session.
2. Vendor (copy) the standards files directly into `my-intern`, dropping the submodule. Rejected: it duplicates the single source of truth, loses the pinned-commit traceability the submodule gives, and diverges from the framework's submodule layout that `AGENTS.md` and `.githooks/pre-push` already assume.
3. Raise Network access from Trusted to Full. Rejected: the failure is a git-credential scope concern at the separate GitHub proxy, not a network-allowlist block; `github.com` is already allowed under Trusted, so this changes nothing.

## Scope

- Includes:
  - `scripts/ensure-standards.sh`: idempotent bootstrap (submodule-first, then pinned-tarball fallback), matching the repo's existing shell-hook style.
  - `.claude/settings.json`: a `SessionStart` hook (matcher `startup|resume`) invoking the script.
  - `scripts/ensure-standards.test.sh`: a plain-bash test covering the Acceptance Criteria, written before the script.
- Does NOT include:
  - Changing the submodule pointer or gitlink commit in `.gitmodules`.
  - Modifying cloud environment configuration, Network access level, or any GitHub credential scope.
  - Vendoring or committing the standards content into this repository.
  - Altering the existing `.githooks/pre-push` Codex R2 flow.

## Acceptance Criteria

- `populates_standards_index_when_absent`: given the sentinel `.standards/docs/standards/INDEX.md` is absent and a source (submodule or public tarball) is reachable, running the script creates that file and exits 0.
- `is_noop_when_standards_present`: given the sentinel already exists, the script performs no fetch and exits 0.
- `exits_zero_without_blocking_on_failure`: given every source is unreachable, the script exits 0 and writes a warning to stderr rather than failing the session.
- `uses_pinned_commit_for_fallback`: the tarball fallback requests the commit recorded by the superproject gitlink for `.standards`, not an arbitrary branch.

## Reproducibility

- In-session trigger: `"$CLAUDE_PROJECT_DIR"/scripts/ensure-standards.sh`, or starting/resuming a web session.
- Test: `bash scripts/ensure-standards.test.sh` from the repository root.
- Pinned commit: the gitlink SHA from `git ls-tree HEAD .standards` (currently `776a1b5a4aaa8fce299499b18f0fd806d461809a`).
- Relevant versions: bash 5.x, git 2.x, curl 8.x, GNU tar 1.3x; Network access level Trusted (allowlists `codeload.github.com`).

## Risks and Assumptions

- Assumption: `LukeSantossz/my-framework` stays public; if it becomes private the tarball fallback returns 403 and the script degrades to a warning, while the submodule path still works where credentials allow.
- Assumption: `codeload.github.com` remains on the Trusted allowlist (confirmed in current Claude Code on the web docs).
- Assumption: the pinned commit remains fetchable as a tarball from the public repository.
- Invalidated if: the standards move out of `.standards/docs/standards/`, or the project decides to vendor the standards instead of using the submodule.
