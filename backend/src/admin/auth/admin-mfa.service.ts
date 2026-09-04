import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DataSource, IsNull, type Repository } from "typeorm";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminMfaChallengeEntity } from "../entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import type { MfaLoginChallenge } from "./auth.types";
import { AdminAuthService } from "./admin-auth.service";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  totpUri,
  verifyTotp
} from "./mfa";

const genericMfaMessage = "MFA challenge or code is invalid";

@Injectable()
export class AdminMfaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly auth: AdminAuthService
  ) {}

  async begin(userSnapshot: AdminUserEntity): Promise<MfaLoginChallenge> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(AdminUserEntity).findOne({
        where: { id: userSnapshot.id },
        lock: { mode: "pessimistic_write" }
      });
      if (
        !user
        || !user.is_active
        || user.role !== "admin"
        || (user.locked_until && user.locked_until.getTime() > Date.now())
        || user.password_hash !== userSnapshot.password_hash
        || user.password_changed_at.getTime() !== userSnapshot.password_changed_at.getTime()
      ) {
        throw new UnauthorizedException(genericMfaMessage);
      }

      const now = new Date();
      const challenges = manager.getRepository(AdminMfaChallengeEntity);
      await challenges.createQueryBuilder()
        .update(AdminMfaChallengeEntity)
        .set({ consumed_at: now })
        .where("admin_user_id = :adminUserId", { adminUserId: user.id })
        .andWhere("consumed_at IS NULL")
        .execute();

      const id = randomUUID();
      const tokenSecret = randomBytes(32).toString("base64url");
      const ttlSeconds = this.config.get("MFA_CHALLENGE_TTL_SECONDS", { infer: true });
      const enrollmentSecret = user.mfa_enabled ? null : generateTotpSecret();
      const challenge = challenges.create({
        id,
        admin_user_id: user.id,
        purpose: user.mfa_enabled ? "login" : "enrollment",
        token_hash: this.hashChallengeSecret(tokenSecret),
        pending_secret_ciphertext: enrollmentSecret
          ? encryptMfaSecret(
            enrollmentSecret,
            this.config.get("MFA_ENCRYPTION_KEY", { infer: true }),
            this.challengeContext(id)
          )
          : null,
        password_changed_at: user.password_changed_at,
        failed_attempts: 0,
        expires_at: new Date(now.getTime() + ttlSeconds * 1_000),
        consumed_at: null
      });
      await challenges.save(challenge);

      return {
        status: "mfa_required",
        mode: enrollmentSecret ? "enroll" : "verify",
        challengeToken: `${id}.${tokenSecret}`,
        expiresInSeconds: ttlSeconds,
        setup: enrollmentSecret
          ? {
            secret: enrollmentSecret,
            otpauthUri: totpUri(
              user.email,
              enrollmentSecret,
              this.config.get("MFA_ISSUER", { infer: true })
            )
          }
          : undefined
      };
    });
  }

  async complete(challengeToken: string, code: string) {
    const parsed = this.parseChallengeToken(challengeToken);
    const outcome = await this.dataSource.transaction(async (manager) => {
      const challenges = manager.getRepository(AdminMfaChallengeEntity);
      const reference = await challenges.findOneBy({ id: parsed.challengeId });
      if (!reference) return { kind: "invalid" as const };

      const users = manager.getRepository(AdminUserEntity);
      const user = await users.findOne({
        where: { id: reference.admin_user_id },
        lock: { mode: "pessimistic_write" }
      });
      const challenge = await challenges.findOne({
        where: { id: parsed.challengeId, admin_user_id: reference.admin_user_id },
        lock: { mode: "pessimistic_write" }
      });
      const now = new Date();
      if (
        !user
        || !challenge
        || !this.matchesChallengeSecret(challenge.token_hash, parsed.secret)
        || challenge.consumed_at
        || challenge.expires_at.getTime() <= now.getTime()
        || challenge.failed_attempts >= this.maxAttempts()
        || !user.is_active
        || user.role !== "admin"
        || (user.locked_until && user.locked_until.getTime() > now.getTime())
        || user.password_changed_at.getTime() !== challenge.password_changed_at.getTime()
      ) {
        return { kind: "invalid" as const };
      }

      let secret: string;
      if (challenge.purpose === "enrollment") {
        if (user.mfa_enabled || !challenge.pending_secret_ciphertext) {
          return { kind: "invalid" as const };
        }
        secret = decryptMfaSecret(
          challenge.pending_secret_ciphertext,
          this.config.get("MFA_ENCRYPTION_KEY", { infer: true }),
          this.challengeContext(challenge.id)
        );
      } else {
        if (!user.mfa_enabled || !user.mfa_secret_ciphertext) {
          return { kind: "invalid" as const };
        }
        secret = decryptMfaSecret(
          user.mfa_secret_ciphertext,
          this.config.get("MFA_ENCRYPTION_KEY", { infer: true }),
          this.userContext(user.id)
        );
      }

      const matchedCounter = verifyTotp(secret, code, {
        lastAcceptedCounter: user.last_totp_counter
      });
      let usedRecoveryCode = false;
      let recovery: AdminMfaRecoveryCodeEntity | null = null;
      if (matchedCounter === null && challenge.purpose === "login") {
        const normalizedRecovery = normalizeRecoveryCode(code);
        if (normalizedRecovery) {
          recovery = await manager.getRepository(AdminMfaRecoveryCodeEntity).findOne({
            where: {
              admin_user_id: user.id,
              code_hash: hashRecoveryCode(
                normalizedRecovery,
                this.config.get("MFA_RECOVERY_PEPPER", { infer: true })
              ),
              used_at: IsNull()
            },
            lock: { mode: "pessimistic_write" }
          });
          usedRecoveryCode = Boolean(recovery);
        }
      }

      if (matchedCounter === null && !usedRecoveryCode) {
        challenge.failed_attempts += 1;
        this.recordFailedMfaAttempt(user, now);
        if (
          challenge.failed_attempts >= this.maxAttempts()
          || (user.locked_until && user.locked_until.getTime() > now.getTime())
        ) {
          challenge.consumed_at = now;
        }
        await users.save(user);
        await challenges.save(challenge);
        return { kind: "invalid" as const };
      }

      let recoveryCodes: string[] | undefined;
      if (challenge.purpose === "enrollment") {
        user.mfa_secret_ciphertext = encryptMfaSecret(
          secret,
          this.config.get("MFA_ENCRYPTION_KEY", { infer: true }),
          this.userContext(user.id)
        );
        user.mfa_enabled = true;
        user.mfa_enrolled_at = now;
        recoveryCodes = await this.replaceRecoveryCodes(
          manager.getRepository(AdminMfaRecoveryCodeEntity),
          user.id
        );
      }
      if (matchedCounter !== null) user.last_totp_counter = matchedCounter;
      if (recovery) {
        recovery.used_at = now;
        await manager.getRepository(AdminMfaRecoveryCodeEntity).save(recovery);
      }

      user.last_login_at = now;
      user.failed_login_count = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      await users.save(user);
      challenge.consumed_at = now;
      await challenges.save(challenge);

      const session = await this.auth.createAuthenticatedSession(manager, user, now);
      return {
        kind: "success" as const,
        session,
        recoveryCodes,
        usedRecoveryCode
      };
    });

    if (outcome.kind !== "success") throw new UnauthorizedException(genericMfaMessage);
    return outcome;
  }

  async regenerateRecoveryCodes(adminUserId: string, sessionId: string, code: string) {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(AdminUserEntity).findOne({
        where: { id: adminUserId },
        lock: { mode: "pessimistic_write" }
      });
      const session = await manager.getRepository(AdminSessionEntity).findOne({
        where: { id: sessionId, admin_user_id: adminUserId },
        lock: { mode: "pessimistic_write" }
      });
      if (
        !user?.is_active
        || !user.mfa_enabled
        || !user.mfa_secret_ciphertext
        || !session
        || session.revoked_at
        || (user.locked_until && user.locked_until.getTime() > Date.now())
      ) {
        throw new UnauthorizedException(genericMfaMessage);
      }

      const secret = decryptMfaSecret(
        user.mfa_secret_ciphertext,
        this.config.get("MFA_ENCRYPTION_KEY", { infer: true }),
        this.userContext(user.id)
      );
      const counter = verifyTotp(secret, code, {
        lastAcceptedCounter: user.last_totp_counter
      });
      if (counter === null) {
        this.recordFailedMfaAttempt(user, new Date());
        await manager.getRepository(AdminUserEntity).save(user);
        return { kind: "invalid" as const };
      }

      const now = new Date();
      user.last_totp_counter = counter;
      user.failed_login_count = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      session.mfa_verified_at = now;
      await manager.getRepository(AdminUserEntity).save(user);
      await manager.getRepository(AdminSessionEntity).save(session);
      return {
        kind: "success" as const,
        recoveryCodes: await this.replaceRecoveryCodes(
          manager.getRepository(AdminMfaRecoveryCodeEntity),
          user.id
        )
      };
    });

    if (outcome.kind !== "success") throw new UnauthorizedException(genericMfaMessage);
    return { recoveryCodes: outcome.recoveryCodes };
  }

  private async replaceRecoveryCodes(
    repository: Repository<AdminMfaRecoveryCodeEntity>,
    adminUserId: string
  ): Promise<string[]> {
    const recoveryCodes = generateRecoveryCodes();
    await repository.delete({ admin_user_id: adminUserId });
    await repository.save(recoveryCodes.map((code) => repository.create({
      admin_user_id: adminUserId,
      code_hash: hashRecoveryCode(
        code,
        this.config.get("MFA_RECOVERY_PEPPER", { infer: true })
      ),
      used_at: null
    })));
    return recoveryCodes;
  }

  private parseChallengeToken(token: string): { challengeId: string; secret: string } {
    const [challengeId, secret, ...rest] = token.split(".");
    if (
      !challengeId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId)
      || !secret
      || secret.length !== 43
      || rest.length
    ) {
      throw new UnauthorizedException(genericMfaMessage);
    }
    return { challengeId, secret };
  }

  private matchesChallengeSecret(expectedHash: string, secret: string): boolean {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(this.hashChallengeSecret(secret), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashChallengeSecret(secret: string): string {
    // Challenge secrets are 256 random bits and are never user-selected passwords.
    return createHash("sha256").update(secret).digest("hex");
  }

  private maxAttempts(): number {
    return this.config.get("MFA_MAX_ATTEMPTS", { infer: true });
  }

  private recordFailedMfaAttempt(user: AdminUserEntity, now: Date): void {
    if (user.locked_until && user.locked_until.getTime() > now.getTime()) return;
    if (user.locked_until && user.locked_until.getTime() <= now.getTime()) {
      user.failed_login_count = 0;
      user.locked_until = null;
    }

    user.failed_login_count += 1;
    user.last_failed_login_at = now;
    const limit = this.config.get("ADMIN_MAX_FAILED_LOGINS", { infer: true });
    if (user.failed_login_count >= limit) {
      const minutes = this.config.get("ADMIN_LOCKOUT_MINUTES", { infer: true });
      user.locked_until = new Date(now.getTime() + minutes * 60_000);
    }
  }

  private challengeContext(id: string): string {
    return `mr-clean:admin-mfa-challenge:${id}`;
  }

  private userContext(id: string): string {
    return `mr-clean:admin-mfa-user:${id}`;
  }
}
