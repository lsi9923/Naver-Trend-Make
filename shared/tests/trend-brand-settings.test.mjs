import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTrendExcludedTermsForMode,
  splitTrendExcludedTermsInput
} from "../dist/index.js";

test("brand excluded terms are cleared when brand exclusion is disabled", () => {
  assert.deepEqual(normalizeTrendExcludedTermsForMode(false, ["Nike", " adidas ", "Nike"]), []);
});

test("brand excluded terms are normalized and deduped when brand exclusion is enabled", () => {
  assert.deepEqual(normalizeTrendExcludedTermsForMode(true, ["Nike", " adidas ", "Nike"]), ["adidas", "nike"]);
});

test("comma input is split into trimmed excluded term tokens", () => {
  assert.deepEqual(splitTrendExcludedTermsInput(" nike, adidas ,, "), ["nike", "adidas"]);
});
