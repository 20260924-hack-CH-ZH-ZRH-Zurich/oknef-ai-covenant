import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completionText } from "../src/format.js";

const response = {
  answer: "Review the following inventory and succession steps.",
  cards: [
    { title: "Inventory", body: "Check the synthetic account.", items: ["Record the provider.", "Identify missing ownership evidence."] },
    { title: "Succession", body: "Human review is required.", items: ["Confirm the intended beneficiary.", "Do not release assets."] },
  ],
};

test("completion text retains the answer and every card title, body and checklist item", () => {
  const text = completionText(response);
  assert.ok(text.startsWith(response.answer));
  for (const card of response.cards) {
    assert.ok(text.includes(card.title));
    assert.ok(text.includes(card.body));
    for (const item of card.items) assert.ok(text.includes(`- ${item}`));
  }
  assert.ok(text.indexOf("Inventory") < text.indexOf("Succession"));
});

test("oversized completion text has an explicit notice within a UTF-8-safe 40,000-byte cap", () => {
  for (const character of ["a", "é", "🗝"]) {
    const text = completionText({ ...response, answer: character.repeat(40000) });
    assert.ok(Buffer.byteLength(text, "utf8") <= 40000);
    assert.ok(text.endsWith("[Response truncated at 40,000 UTF-8 bytes; some details were omitted.]"));
    assert.equal(text.includes("\uFFFD"), false);
  }
});

test("formatting emits text only and does not carry action properties or authority", () => {
  const text = completionText({
    ...response,
    execute: "release_assets",
    cards: [{ ...response.cards[0], onClick: "release_assets", action: { type: "transfer" } }],
  });
  assert.equal(text.includes("release_assets"), false);
  assert.equal(text.includes("transfer"), false);
  assert.equal(text.includes("<"), false);
  assert.throws(() => completionText({ answer: "No cards supplied" }));
  assert.throws(() => completionText({ ...response, cards: [{ title: "Unsafe", body: "Text", items: [{ execute: "release" }] }] }));
});
