import { describe, expect, it } from "bun:test";
import { parseIcs, unescapeIcsText, unfoldIcsLines } from "./icsParser";

describe("icsParser helpers", () => {
  it("unfolds folded lines", () => {
    const lines = unfoldIcsLines("DESCRIPTION:Line one\r\n Line two\r\nSUMMARY:Test\r\n");
    expect(lines).toEqual(["DESCRIPTION:Line oneLine two", "SUMMARY:Test"]);
  });

  it("unescapes RFC5545 TEXT values", () => {
    expect(unescapeIcsText("alpha\\,beta\\;gamma\\nline2\\\\tail")).toBe(
      "alpha,beta;gamma\nline2\\tail"
    );
  });
});

describe("parseIcs", () => {
  it("parses DTSTART forms (DATE, TZID, UTC Z), RRULE/EXDATE, and RECURRENCE-ID", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "X-WR-TIMEZONE:America/Chicago",
      "BEGIN:VEVENT",
      "UID:date-only",
      "DTSTART;VALUE=DATE:20260215",
      "SUMMARY:All Day",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:tzid-event",
      "DTSTART;TZID=America/Chicago:20260216T090000",
      "DTEND;TZID=America/Chicago:20260216T093000",
      "RRULE:FREQ=DAILY;INTERVAL=1",
      "EXDATE;TZID=America/Chicago:20260217T090000",
      "SUMMARY:Recurring",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:utc-override",
      "DTSTART:20260218T150000Z",
      "RECURRENCE-ID:20260218T140000Z",
      "STATUS:CANCELLED",
      "SUMMARY:Override",
      "DESCRIPTION:Hello\\, world\\nSecond line",
      "CATEGORIES:one,two",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const parsed = parseIcs(ics);
    expect(parsed.calendarTimeZone).toBe("America/Chicago");
    expect(parsed.events).toHaveLength(3);

    const allDay = parsed.events[0];
    expect(allDay?.uid).toBe("date-only");
    expect(allDay?.dtstart?.kind).toBe("date");
    expect(allDay?.dtstart?.raw).toBe("20260215");

    const recurring = parsed.events[1];
    expect(recurring?.uid).toBe("tzid-event");
    expect(recurring?.dtstart?.kind).toBe("date-time");
    expect(recurring?.dtstart?.tzid).toBe("America/Chicago");
    expect(recurring?.rrule).toBe("FREQ=DAILY;INTERVAL=1");
    expect(recurring?.exdates).toHaveLength(1);
    expect(recurring?.exdates[0]?.raw).toBe("20260217T090000");

    const override = parsed.events[2];
    expect(override?.uid).toBe("utc-override");
    expect(override?.dtstart?.isUtc).toBe(true);
    expect(override?.recurrenceId?.raw).toBe("20260218T140000Z");
    expect(override?.status).toBe("CANCELLED");
    expect(override?.description).toBe("Hello, world\nSecond line");
    expect(override?.categories).toEqual(["one", "two"]);
  });

  it("parses property parameters and TADOI custom identifiers", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:tadoi-series-abc@local",
      "X-TADOI-TASK-ID:abc",
      "X-TADOI-SERIES-ID:series:abc",
      "X-TADOI-INSTANCE-OF:abc",
      "DTSTART;TZID=\"America/Chicago\":20260219T090000",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const parsed = parseIcs(ics);
    expect(parsed.events).toHaveLength(1);
    const event = parsed.events[0];
    expect(event?.xTaskId).toBe("abc");
    expect(event?.xSeriesId).toBe("series:abc");
    expect(event?.xInstanceOf).toBe("abc");
    expect(event?.dtstart?.tzid).toBe("America/Chicago");
  });
});
