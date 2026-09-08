import { hashBootstrapToken } from "../admin/auth/mfa";

export type MfaBootstrapInput = {
  tokenHash: string;
  expiresAt: Date;
  ttlMinutes: number;
};

export function readMfaBootstrapInput(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date()
): MfaBootstrapInput {
  const token = environment.MFA_BOOTSTRAP_TOKEN;
  if (!token) {
    throw new Error(
      "MFA_BOOTSTRAP_TOKEN must be a fresh 32-byte value encoded as unpadded Base64URL"
    );
  }

  const parsedTtl = Number(environment.MFA_BOOTSTRAP_TTL_MINUTES ?? 15);
  if (!Number.isInteger(parsedTtl) || parsedTtl < 5 || parsedTtl > 60) {
    throw new Error("MFA_BOOTSTRAP_TTL_MINUTES must be an integer between 5 and 60");
  }

  return {
    tokenHash: hashBootstrapToken(token),
    expiresAt: new Date(now.getTime() + parsedTtl * 60_000),
    ttlMinutes: parsedTtl
  };
}
