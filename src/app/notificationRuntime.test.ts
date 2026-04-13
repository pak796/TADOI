import { describe, expect, it } from "bun:test";
import type { NotificationSettings } from "../settings/settings";
import {
  getTerminalBellCooldownMs,
  isInAppOverdueEnabled,
  isTerminalBellOverdueEnabled,
} from "./notificationRuntime";

describe("notificationRuntime helpers", () => {
  const enabledSettings: NotificationSettings = {
    enabled: true,
    inAppOverdueBanner: true,
    terminalBellOnOverdue: true,
    bellCooldownMs: 15000,
  };

  it("computes in-app and terminal bell enablement", () => {
    expect(isInAppOverdueEnabled(enabledSettings)).toBe(true);
    expect(isTerminalBellOverdueEnabled(enabledSettings)).toBe(true);

    expect(
      isInAppOverdueEnabled({
        ...enabledSettings,
        enabled: false,
      }),
    ).toBe(false);
    expect(
      isTerminalBellOverdueEnabled({
        ...enabledSettings,
        terminalBellOnOverdue: false,
      }),
    ).toBe(false);
  });

  it("returns terminal bell cooldown ms", () => {
    expect(getTerminalBellCooldownMs(enabledSettings)).toBe(15000);
  });
});
