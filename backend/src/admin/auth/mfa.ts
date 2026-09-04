import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const totpDigits = 6;
const totpPeriodSeconds = 30;

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpUri(email: string, secret: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const parameters = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(totpDigits),
    period: String(totpPeriodSeconds)
  });
  return `otpauth://totp/${label}?${parameters.toString()}`;
}

export function verifyTotp(
  secret: string,
  candidate: string,
  options: { now?: number; lastAcceptedCounter?: number | null } = {}
): number | null {
  if (!/^\d{6}$/.test(candidate)) return null;

  const currentCounter = Math.floor((options.now ?? Date.now()) / 1_000 / totpPeriodSeconds);
  const lastAccepted = options.lastAcceptedCounter ?? -1;
  for (const counter of [currentCounter, currentCounter - 1, currentCounter + 1]) {
    if (counter <= lastAccepted) continue;
    const expected = hotp(secret, counter);
    if (safeEqual(expected, candidate)) return counter;
  }
  return null;
}

export function totpCode(secret: string, now = Date.now()): string {
  return hotp(secret, Math.floor(now / 1_000 / totpPeriodSeconds));
}

export function encryptMfaSecret(
  plaintext: string,
  encodedKey: string,
  context: string
): string {
  const key = encryptionKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")]
    .join(".");
}

export function decryptMfaSecret(
  envelope: string,
  encodedKey: string,
  context: string
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...rest] = envelope.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || rest.length) {
    throw new Error("MFA secret envelope is invalid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(encodedKey),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = encodeBase32(randomBytes(10));
    return raw.match(/.{1,4}/g)?.join("-") ?? raw;
  });
}

export function normalizeRecoveryCode(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  return /^[A-Z2-7]{16}$/.test(normalized) ? normalized : null;
}

export function hashRecoveryCode(code: string, pepper: string): string {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error("Recovery code is invalid");
  return createHmac("sha256", pepper).update(normalized).digest("hex");
}

function hotp(secret: string, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % (10 ** totpDigits)).padStart(totpDigits, "0");
}

function encryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) throw new Error("MFA encryption key must decode to 32 bytes");
  return key;
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) throw new Error("TOTP secret is invalid");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
