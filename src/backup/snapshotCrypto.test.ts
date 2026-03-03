import { describe, expect, it } from "bun:test";
import {
  decryptSnapshotPayload,
  encryptSnapshotPayload,
  isSnapshotEncryptedPayload
} from "./snapshotCrypto";

describe("snapshotCrypto", () => {
  it("encrypts and decrypts payloads with deterministic test vectors", () => {
    const plaintext = JSON.stringify({ hello: "world", count: 3 }, null, 2);
    const encrypted = encryptSnapshotPayload(plaintext, "correct horse battery staple", {
      salt: Buffer.alloc(16, 7),
      iv: Buffer.alloc(12, 3)
    });
    expect(isSnapshotEncryptedPayload(encrypted)).toBe(true);
    expect(decryptSnapshotPayload(encrypted, "correct horse battery staple")).toBe(plaintext);
  });

  it("rejects decrypt with the wrong passphrase", () => {
    const encrypted = encryptSnapshotPayload('{"secure":true}', "passphrase");
    expect(() => decryptSnapshotPayload(encrypted, "wrong")).toThrow(
      "Unable to decrypt snapshot payload"
    );
  });

  it("does not treat plain JSON as encrypted payload", () => {
    expect(isSnapshotEncryptedPayload('{"tasks":[]}')).toBe(false);
  });
});
