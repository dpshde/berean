import assert from "node:assert/strict";
import { test } from "node:test";
import { statusView } from "../src/lib/status-view.ts";

test("statusView shows Yes/No only for polar questions", () => {
  const yes = statusView({ questionKind: "yes_no", verdict: "yes" });
  assert.equal(yes.showVerdict, true);
  assert.equal(yes.verdictLabel, "Yes");
  assert.equal(yes.verdictMeta, "supported · BSB");
  assert.equal(yes.showRelations, true);

  const no = statusView({ questionKind: "yes_no", verdict: "no" });
  assert.equal(no.verdictLabel, "No");
  assert.equal(no.verdictMeta, "not supported · BSB");
});

test("statusView hides the claim verdict for free-form queries", () => {
  const view = statusView({ questionKind: "free_form", verdict: "yes" });
  assert.equal(view.showVerdict, false);
  assert.equal(view.verdictLabel, "");
  assert.equal(view.verdictMeta, "BSB");
  assert.equal(view.showRelations, false);
});

test("statusView hides the verdict when kind or verdict is missing", () => {
  assert.equal(statusView({ questionKind: "yes_no", verdict: null }).showVerdict, false);
  assert.equal(statusView({ verdict: "yes" }).showVerdict, false);
});
