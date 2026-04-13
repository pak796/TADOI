import { describe, expect, it } from "bun:test";
import {
  getTitleCompletion,
  getTitleQuery,
  rankTaskTitles,
} from "./titleAutocomplete";

describe("titleAutocomplete", () => {
  it("does not suggest when title query is empty or has trailing whitespace", () => {
    expect(getTitleQuery("")).toBeNull();
    expect(getTitleQuery("   ")).toBeNull();
    expect(getTitleQuery("Write ")).toBeNull();
  });

  it("ranks title suggestions from all task history by usage then recency", () => {
    const tasks = [
      { title: "Write release notes", createdAt: 10, updatedAt: 20 },
      { title: "write release notes", createdAt: 30, updatedAt: 40 },
      { title: "Write design doc", createdAt: 50, updatedAt: 60 },
      { title: "write onboarding guide", createdAt: 70, updatedAt: 80 },
      { title: "Plan sprint", createdAt: 90, updatedAt: 100 },
    ];

    expect(rankTaskTitles(tasks, "wri")).toEqual([
      "write release notes",
      "write onboarding guide",
      "Write design doc",
    ]);
  });

  it("resolves completion remainder case-insensitively", () => {
    const completion = getTitleCompletion("Wri", [
      "write release notes",
      "Write design doc",
    ]);
    expect(completion).toEqual({
      full: "write release notes",
      remainder: "te release notes",
    });
  });

  it("returns null when query already matches full title", () => {
    expect(
      getTitleCompletion("Write design doc", ["Write design doc"]),
    ).toBeNull();
  });
});
