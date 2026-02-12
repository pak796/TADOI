import { describe, expect, it } from "bun:test";
import { getDefaultSettings } from "../settings/settings";
import { validatePersistedState } from "./validation";

describe("settings + validation contracts", () => {
  it("keeps default settings values in allowed runtime ranges/enums", () => {
    const defaults = getDefaultSettings();
    expect(["prompt", "block"]).toContain(defaults.security.nonHttpLinkPolicy);
    expect(Number.isInteger(defaults.notifications.bannerDurationMs)).toBe(true);
    expect(defaults.notifications.bannerDurationMs).toBeGreaterThan(0);
    expect(Number.isInteger(defaults.notifications.bellCooldownMs)).toBe(true);
    expect(defaults.notifications.bellCooldownMs).toBeGreaterThan(0);
  });

  it("accepts persisted link enums used by import and manual link flows", () => {
    const result = validatePersistedState(
      {
        schemaVersion: 4,
        tasks: [
          {
            id: "task-1",
            title: "Task",
            status: "open",
            createdAt: 1,
            updatedAt: 1,
            tags: ["ops"],
            links: [
              {
                id: "manual-link",
                target: "https://example.com",
                kind: "url",
                source: "manual"
              },
              {
                id: "imported-path",
                target: "/tmp/notes.txt",
                kind: "path",
                source: "calendar_import"
              }
            ]
          }
        ],
        tagIndex: {},
        savedViews: []
      },
      "strict"
    );
    expect(result.ok).toBe(true);
  });
});
