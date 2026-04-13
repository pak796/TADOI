import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";

export const SNAPSHOT_ENCRYPTION_KIND = "tadoi.snapshot.encrypted.v1";
export const SNAPSHOT_ENCRYPTION_SCHEME = "aes-256-gcm+scrypt-v1";

const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;

export type SnapshotEncryptedPayload = {
  kind: typeof SNAPSHOT_ENCRYPTION_KIND;
  scheme: typeof SNAPSHOT_ENCRYPTION_SCHEME;
  kdf: {
    name: "scrypt";
    saltB64: string;
    keyLen: number;
    N: number;
    r: number;
    p: number;
  };
  cipher: {
    name: "aes-256-gcm";
    ivB64: string;
    authTagB64: string;
  };
  ciphertextB64: string;
  plainSha256: string;
};

export type EncryptSnapshotPayloadOptions = {
  salt?: Buffer;
  iv?: Buffer;
};

type SnapshotEncryptedPayloadRecord = SnapshotEncryptedPayload &
  Record<string, unknown>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolvePassphrase(passphrase: string): string {
  const trimmed = passphrase.trim();
  if (!trimmed) {
    throw new Error("Snapshot encryption passphrase is required.");
  }
  return trimmed;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
  }) as Buffer;
}

function decodeBase64Field(value: string, fieldName: string): Buffer {
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 0 && value.length > 0) {
      throw new Error("empty decode");
    }
    return decoded;
  } catch {
    throw new Error(
      `Encrypted snapshot payload field '${fieldName}' is not valid base64.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEncryptedPayload(raw: string): SnapshotEncryptedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Encrypted snapshot payload is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Encrypted snapshot payload must be a JSON object.");
  }
  const payload = parsed as Partial<SnapshotEncryptedPayloadRecord>;

  if (
    payload.kind !== SNAPSHOT_ENCRYPTION_KIND ||
    payload.scheme !== SNAPSHOT_ENCRYPTION_SCHEME
  ) {
    throw new Error(
      "Encrypted snapshot payload kind or scheme is unsupported.",
    );
  }
  if (!isRecord(payload.kdf) || payload.kdf.name !== "scrypt") {
    throw new Error("Encrypted snapshot payload kdf metadata is invalid.");
  }
  if (!isRecord(payload.cipher) || payload.cipher.name !== "aes-256-gcm") {
    throw new Error("Encrypted snapshot payload cipher metadata is invalid.");
  }
  if (
    typeof payload.ciphertextB64 !== "string" ||
    payload.ciphertextB64.length === 0
  ) {
    throw new Error("Encrypted snapshot payload ciphertext is missing.");
  }
  if (
    typeof payload.plainSha256 !== "string" ||
    payload.plainSha256.length === 0
  ) {
    throw new Error("Encrypted snapshot payload hash is missing.");
  }
  if (
    typeof payload.kdf.saltB64 !== "string" ||
    typeof payload.kdf.keyLen !== "number" ||
    typeof payload.kdf.N !== "number" ||
    typeof payload.kdf.r !== "number" ||
    typeof payload.kdf.p !== "number"
  ) {
    throw new Error("Encrypted snapshot payload kdf parameters are invalid.");
  }
  if (
    typeof payload.cipher.ivB64 !== "string" ||
    typeof payload.cipher.authTagB64 !== "string"
  ) {
    throw new Error(
      "Encrypted snapshot payload cipher parameters are invalid.",
    );
  }

  return payload as SnapshotEncryptedPayload;
}

export function isSnapshotEncryptedPayload(raw: string): boolean {
  try {
    const payload = parseEncryptedPayload(raw);
    return (
      payload.kind === SNAPSHOT_ENCRYPTION_KIND &&
      payload.scheme === SNAPSHOT_ENCRYPTION_SCHEME
    );
  } catch {
    return false;
  }
}

export function encryptSnapshotPayload(
  plaintext: string,
  passphrase: string,
  options: EncryptSnapshotPayloadOptions = {},
): string {
  const safePassphrase = resolvePassphrase(passphrase);
  const salt = options.salt ?? randomBytes(SALT_LENGTH_BYTES);
  const iv = options.iv ?? randomBytes(IV_LENGTH_BYTES);
  const key = deriveKey(safePassphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload: SnapshotEncryptedPayload = {
    kind: SNAPSHOT_ENCRYPTION_KIND,
    scheme: SNAPSHOT_ENCRYPTION_SCHEME,
    kdf: {
      name: "scrypt",
      saltB64: salt.toString("base64"),
      keyLen: KEY_LENGTH_BYTES,
      N: 16384,
      r: 8,
      p: 1,
    },
    cipher: {
      name: "aes-256-gcm",
      ivB64: iv.toString("base64"),
      authTagB64: authTag.toString("base64"),
    },
    ciphertextB64: ciphertext.toString("base64"),
    plainSha256: sha256(plaintext),
  };

  return JSON.stringify(payload, null, 2);
}

export function decryptSnapshotPayload(
  raw: string,
  passphrase: string,
): string {
  const safePassphrase = resolvePassphrase(passphrase);
  const payload = parseEncryptedPayload(raw);

  const salt = decodeBase64Field(payload.kdf.saltB64, "kdf.saltB64");
  const iv = decodeBase64Field(payload.cipher.ivB64, "cipher.ivB64");
  const authTag = decodeBase64Field(
    payload.cipher.authTagB64,
    "cipher.authTagB64",
  );
  const ciphertext = decodeBase64Field(payload.ciphertextB64, "ciphertextB64");

  if (payload.kdf.keyLen !== KEY_LENGTH_BYTES) {
    throw new Error("Encrypted snapshot payload key length is unsupported.");
  }

  try {
    const key = scryptSync(safePassphrase, salt, payload.kdf.keyLen, {
      N: payload.kdf.N,
      r: payload.kdf.r,
      p: payload.kdf.p,
    }) as Buffer;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    if (sha256(plaintext) !== payload.plainSha256) {
      throw new Error("integrity mismatch");
    }
    return plaintext;
  } catch {
    throw new Error(
      "Unable to decrypt snapshot payload. Verify TADOI_GITHUB_SNAPSHOT_PASSPHRASE and retry.",
    );
  }
}
