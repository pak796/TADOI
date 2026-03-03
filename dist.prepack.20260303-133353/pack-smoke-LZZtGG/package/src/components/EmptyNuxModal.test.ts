import { describe, expect, it } from "bun:test";
import { resolveEmptyNuxModalMeta } from "./EmptyNuxModal";

describe("resolveEmptyNuxModalMeta", () => {
  it("returns welcome metadata", () => {
    expect(resolveEmptyNuxModalMeta("welcome")).toEqual({
      title: "Welcome to TADOI",
      closeAction: "dismiss_session"
    });
  });

  it("returns shortcuts metadata", () => {
    expect(resolveEmptyNuxModalMeta("shortcuts")).toEqual({
      title: "TADOI Shortcuts",
      closeAction: "clear_walkthrough"
    });
  });

  it("returns celebrate metadata", () => {
    expect(resolveEmptyNuxModalMeta("celebrate")).toEqual({
      title: "First Task Created",
      closeAction: "clear_walkthrough"
    });
  });
});
