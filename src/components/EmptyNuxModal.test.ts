import { describe, expect, it } from "bun:test";
import {
  describeOnboardingProgress,
  resolveEmptyNuxModalMeta
} from "./EmptyNuxModal";

describe("resolveEmptyNuxModalMeta", () => {
  it("returns welcome metadata", () => {
    expect(resolveEmptyNuxModalMeta("welcome")).toEqual({
      title: "WELCOME TO TADOI",
      closeAction: "dismiss_session"
    });
  });

  it("returns shortcuts metadata", () => {
    expect(resolveEmptyNuxModalMeta("shortcuts")).toEqual({
      title: "TADOI SHORTCUTS",
      closeAction: "clear_walkthrough"
    });
  });

  it("returns celebrate metadata", () => {
    expect(resolveEmptyNuxModalMeta("celebrate")).toEqual({
      title: "FIRST TASK CREATED",
      closeAction: "clear_walkthrough"
    });
  });

  it("returns what-next metadata", () => {
    expect(resolveEmptyNuxModalMeta("what_next")).toEqual({
      title: "WHAT NEXT",
      closeAction: "clear_walkthrough"
    });
  });
});

describe("describeOnboardingProgress", () => {
  it("formats 0/3 progress", () => {
    expect(
      describeOnboardingProgress({
        firstTask: false,
        firstTome: false,
        firstChecklistComplete: false,
        completed: 0,
        total: 3
      })
    ).toEqual({
      label: "ONBOARDING 0/3",
      chips: ["[ ] TASK", "[ ] TOME", "[ ] CHECKLIST"]
    });
  });

  it("formats 3/3 progress", () => {
    expect(
      describeOnboardingProgress({
        firstTask: true,
        firstTome: true,
        firstChecklistComplete: true,
        completed: 3,
        total: 3
      })
    ).toEqual({
      label: "ONBOARDING 3/3",
      chips: ["[x] TASK", "[x] TOME", "[x] CHECKLIST"]
    });
  });
});
