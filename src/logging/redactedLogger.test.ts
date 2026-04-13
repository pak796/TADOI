import { describe, expect, it } from "bun:test";
import { createRedactedLogger, redactLogValue } from "./redactedLogger";

describe("redactedLogger", () => {
  it("redacts absolute paths in string arguments", () => {
    const calls: unknown[][] = [];
    const logger = createRedactedLogger({
      log: (...args: unknown[]) => calls.push(args),
      warn: (...args: unknown[]) => calls.push(args),
      error: (...args: unknown[]) => calls.push(args),
      debug: (...args: unknown[]) => calls.push(args),
    });

    logger.error("failed to open /tmp/private/notes.md");
    const first = String(calls[0]?.[0] ?? "");
    expect(first).toContain("~/.../notes.md");
    expect(first).not.toContain("/tmp/private/notes.md");
  });

  it("redacts sensitive keys in structured payloads", () => {
    const payload = redactLogValue({
      ownerRepo: "patrick/tadoi-backups",
      accessToken: "ghp_abcdefghijklmnopqrstuvwxyz123456",
      nested: {
        passphrase: "super-secret",
      },
    }) as {
      ownerRepo?: string;
      accessToken?: string;
      nested?: { passphrase?: string };
    };
    expect(payload.ownerRepo).toBe("patrick/tadoi-backups");
    expect(payload.accessToken).toBe("[REDACTED]");
    expect(payload.nested?.passphrase).toBe("[REDACTED]");
  });

  it("redacts inline credential-like tokens", () => {
    const output = redactLogValue(
      "token=ghp_abcdefghijklmnopqrstuvwxyz123456 path=/tmp/file.txt",
    );
    expect(String(output)).toContain("[REDACTED]");
    expect(String(output)).not.toContain(
      "ghp_abcdefghijklmnopqrstuvwxyz123456",
    );
  });
});
