import { describe, expect, it } from "bun:test";
import { escapeIcsText, foldIcsLine, renderIcsCalendar } from "./icsWriter";

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

  it("omits URL values that contain control characters", () => {
    const rendered = renderIcsCalendar({
      timeContext: { mode: "utc", timeZone: "UTC" },
      events: [
        {
          uid: "task-1",
          dtstampUtc: "20260220T120000Z",
          summary: "task",
          categories: [],
          transp: "TRANSPARENT",
          url: "https://example.com/path\nATTENDEE:mailto:evil@example.com",
          dtstart: { kind: "date", value: "20260221" },
          dtend: { kind: "date", value: "20260222" },
          sortKey: "20260221T000000",
        },
      ],
    });

    expect(rendered).not.toContain("URL:https://example.com/path");
    expect(rendered).not.toContain("ATTENDEE:mailto:evil@example.com");
  });
});
