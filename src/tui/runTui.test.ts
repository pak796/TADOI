import { describe, expect, it } from "bun:test";
import { redactStartupPath } from "./runTui";

describe("redactStartupPath", () => {
  it("redacts home-directory absolute paths by default", () => {
    expect(
      redactStartupPath("/Users/patrick/Library/Application Support/tadoi/tadoi_data.json", {
        homeDir: "/Users/patrick"
      })
    ).toBe("~/Library/Application Support/tadoi/tadoi_data.json");
  });

  it("redacts non-home absolute paths by default", () => {
    expect(
      redactStartupPath("/Volumes/External/data/tadoi_data.json", {
        homeDir: "/Users/patrick"
      })
    ).toBe("~/.../tadoi_data.json");
  });

  it("keeps full paths when verbose logging is enabled", () => {
    const targetPath = "/Volumes/External/data/tadoi_data.json";
    expect(
      redactStartupPath(targetPath, {
        homeDir: "/Users/patrick",
        env: { TADOI_VERBOSE_PATH_LOGS: "1" }
      })
    ).toBe(targetPath);
  });

  it("preserves relative paths", () => {
    expect(redactStartupPath("./data/tadoi_data.json", { homeDir: "/Users/patrick" })).toBe(
      "./data/tadoi_data.json"
    );
  });
});
