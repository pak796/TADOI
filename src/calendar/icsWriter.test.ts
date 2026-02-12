import { describe, expect, it } from "bun:test";
import { escapeIcsText, foldIcsLine } from "./icsWriter";

describe("icsWriter", () => {
  it("escapes RFC5545 TEXT values", () => {
    const escaped = escapeIcsText("alpha\\beta;gamma,delta\nline2");
    expect(escaped).toBe("alpha\\\\beta\\;gamma\\,delta\\nline2");
  });

  it("folds lines at 75 octets using CRLF + space continuation", () => {
    const line = `SUMMARY:${"A".repeat(120)}`;
    const folded = foldIcsLine(line);
    const chunks = folded.split("\r\n ");

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(line);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(75);
    }
  });
});
