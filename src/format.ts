const maximumBytes = 40000;
const truncationNotice = "\n\n[Response truncated at 40,000 UTF-8 bytes; some details were omitted.]";

function cardText(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Invalid core card");
  const { title, body, items } = value as Record<string, unknown>;
  if (typeof title !== "string" || typeof body !== "string" || !Array.isArray(items)
    || items.length > 30 || !items.every(item => typeof item === "string")) {
    throw new Error("Invalid core card");
  }
  return [title, body, ...items.map(item => `- ${item}`)].filter(Boolean).join("\n");
}

export function completionText(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Invalid core response");
  const { answer, cards } = value as Record<string, unknown>;
  if (typeof answer !== "string" || !answer || !Array.isArray(cards)
    || cards.length < 1 || cards.length > 5) throw new Error("Invalid core response");
  const text = [answer, ...cards.map(cardText)].join("\n\n");
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= maximumBytes) return text;
  let end = maximumBytes - Buffer.byteLength(truncationNotice, "utf8");
  // Do not split a multibyte character at the retained prefix boundary.
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8") + truncationNotice;
}
