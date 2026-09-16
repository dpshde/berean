import assert from "node:assert/strict";
import { test } from "node:test";
import { routeHref } from "../src/lib/route.ts";

test("routeHref uses OSIS slugs including numbered books", () => {
  assert.equal(routeHref("John", 3, 16), "https://route.bible/jhn.3.16");
  assert.equal(routeHref("1 Corinthians", 6, 18), "https://route.bible/1co.6.18");
  assert.equal(routeHref("Galatians", 5, 22, 23), "https://route.bible/gal.5.22-23");
});
