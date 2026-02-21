import { describe, expect, it } from "bun:test";
import { shouldTriggerSaveConflictRetryFromMouse } from "./saveConflictBannerAction";

describe("save conflict banner mouse action", () => {
  it("triggers retry only for left-click on active non-pending conflict banner", () => {
    expect(
      shouldTriggerSaveConflictRetryFromMouse({
        isSaveConflictBanner: true,
        retryPending: false,
        button: 0
      })
    ).toBe(true);

    expect(
      shouldTriggerSaveConflictRetryFromMouse({
        isSaveConflictBanner: true,
        retryPending: false,
        button: 1
      })
    ).toBe(false);

    expect(
      shouldTriggerSaveConflictRetryFromMouse({
        isSaveConflictBanner: true,
        retryPending: true,
        button: 0
      })
    ).toBe(false);

    expect(
      shouldTriggerSaveConflictRetryFromMouse({
        isSaveConflictBanner: false,
        retryPending: false,
        button: 0
      })
    ).toBe(false);
  });
});
