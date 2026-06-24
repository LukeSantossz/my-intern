import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveAssetPath } from "../lib/filler.mjs";

const base = path.resolve("/tmp/filler-assets-base");

test("resolve_asset_path_returns_null_for_empty", () => {
  assert.equal(resolveAssetPath("", base), null);
  assert.equal(resolveAssetPath(undefined, base), null);
});

test("resolve_asset_path_keeps_relative_paths_inside_base", () => {
  assert.equal(resolveAssetPath("foto.png", base), path.join(base, "foto.png"));
  assert.equal(resolveAssetPath("sub/foto.png", base), path.join(base, "sub", "foto.png"));
});

test("resolve_asset_path_allows_absolute_paths_inside_base", () => {
  const inside = path.join(base, "foto.png");
  assert.equal(resolveAssetPath(inside, base), inside);
});

test("resolve_asset_path_rejects_paths_escaping_base", () => {
  assert.throws(() => resolveAssetPath("../secret.png", base), /escapes/);
  assert.throws(() => resolveAssetPath("../../etc/passwd", base), /escapes/);
  assert.throws(() => resolveAssetPath("/etc/passwd", base), /escapes/);
});
