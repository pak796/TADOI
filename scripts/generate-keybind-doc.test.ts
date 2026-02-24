import { describe, expect, it } from "bun:test";
import { renderCanonicalKeybindDoc } from "./generate-keybind-doc";

describe("renderCanonicalKeybindDoc", () => {
  it("renders a canonical key table from audit payload", () => {
    const markdown = renderCanonicalKeybindDoc(
      {
        canonical_keybinds: ["a", "Ctrl+S"],
        missing_in_docs: [],
        missing_in_code: [],
        semantic_mismatch: [],
        evidence: {
          code: {
            a: ["/repo/src/app/keyRouter.ts:10"],
            "Ctrl+S": ["/repo/src/app/keyRouter.ts:20"]
          },
          docs: {}
        }
      },
      "/repo"
    );

    expect(markdown).toContain("# Canonical Keybindings");
    expect(markdown).toContain("| `a` | src/app/keyRouter.ts:10 |");
    expect(markdown).toContain("| `Ctrl+S` | src/app/keyRouter.ts:20 |");
  });
});
