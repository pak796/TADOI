import { describe, expect, it } from "bun:test";
import { resolveEmptyNuxModalMeta } from "./EmptyNuxModal";

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
});
