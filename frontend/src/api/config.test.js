// Run: node --test src/api/config.test.js  (from frontend/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBase, resolveApiBase } from "./config.js";

test("trailing slashes and whitespace are removed", () => {
  assert.equal(normalizeBase(" https://api.example.com/ "), "https://api.example.com");
  assert.equal(normalizeBase("https://api.example.com///"), "https://api.example.com");
});

test("a configured URL is used as is (production and development)", () => {
  assert.equal(resolveApiBase("https://api.example.com/", false), "https://api.example.com");
  assert.equal(resolveApiBase("http://localhost:5000", true), "http://localhost:5000");
});

test("development falls back to the local backend when VITE_API_URL is missing", () => {
  assert.equal(resolveApiBase(undefined, true), "http://localhost:5000");
  assert.equal(resolveApiBase("   ", true), "http://localhost:5000");
});

test("production without VITE_API_URL fails with a clear configuration error", () => {
  for (const missing of [undefined, "", "   ", null]) {
    assert.throws(() => resolveApiBase(missing, false), /VITE_API_URL is not set/);
  }
});
