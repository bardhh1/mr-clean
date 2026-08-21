import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024
  });

  return [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    hash.toString("base64url")
  ].join("$");
}

export function verifyPassword(password: string, encoded: string): boolean {
  try {
    const [algorithm, rawCost, rawBlockSize, rawParallelization, rawSalt, rawHash] = encoded.split("$");
    if (algorithm !== "scrypt" || !rawSalt || !rawHash) return false;

    const encodedCost = Number(rawCost);
    const encodedBlockSize = Number(rawBlockSize);
    const encodedParallelization = Number(rawParallelization);
    if (
      encodedCost !== cost
      || encodedBlockSize !== blockSize
      || encodedParallelization !== parallelization
    ) return false;

    const expected = Buffer.from(rawHash, "base64url");
    if (expected.length !== keyLength) return false;
    const actual = scryptSync(password, Buffer.from(rawSalt, "base64url"), keyLength, {
      N: encodedCost,
      r: encodedBlockSize,
      p: encodedParallelization,
      maxmem: 64 * 1024 * 1024
    });

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
