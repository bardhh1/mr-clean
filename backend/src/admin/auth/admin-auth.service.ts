import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DataSource, type EntityManager, IsNull, MoreThan, Not, Repository } from "typeorm";
import type { AppEnvironment } from "../../config/env.validation";
import {
  AdminSessionEntity,
  type SessionRevocationReason
} from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import { adminAccessTokenVersion } from "./auth.constants";
import type {
  AccessTokenPayload,
  AdminPrincipal,
  AdminSessionSummary
} from "./auth.types";
import { hashPassword, verifyPassword } from "./password";

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const genericLoginMessage = "Email or password is incorrect";
const dummyPasswordHash = hashPassword("mr-clean-dummy-password-that-is-never-valid");

type CreatedSession = {
  session: AdminSessionEntity;
  refreshToken: string;
};

type RefreshOutcome =
  | { kind: "success"; user: AdminUserEntity; created: CreatedSession }
  | { kind: "invalid" }
  | { kind: "reuse" };

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly users: Repository<AdminUserEntity>,
    @InjectRepository(AdminSessionEntity)
    private readonly sessions: Repository<AdminSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnvironment, true>
  ) {}

  async verifyCredentials(email: string, password: string): Promise<AdminUserEntity> {
    const normalizedEmail = email.trim().toLowerCase();
    const candidate = await this.users.findOne({
      where: { email: normalizedEmail, is_active: true }
    });
    const passwordMatches = candidate
      ? verifyPassword(password, candidate.password_hash)
      : verifyPassword(password, dummyPasswordHash);

    if (!candidate) throw new UnauthorizedException(genericLoginMessage);
    if (candidate.locked_until && candidate.locked_until.getTime() > Date.now()) {
      throw new UnauthorizedException(genericLoginMessage);
    }
    if (!passwordMatches) {
      await this.recordFailedLogin(candidate.id);
      throw new UnauthorizedException(genericLoginMessage);
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(AdminUserEntity);
      const user = await userRepository.findOne({
        where: { id: candidate.id },
        lock: { mode: "pessimistic_write" }
      });
      if (
        !user
        || !user.is_active
        || user.role !== "admin"
        || user.password_hash !== candidate.password_hash
        || (user.locked_until && user.locked_until.getTime() > Date.now())
      ) {
        return null;
      }

      if (user.locked_until && user.locked_until.getTime() <= Date.now()) {
        user.failed_login_count = 0;
        user.last_failed_login_at = null;
        user.locked_until = null;
      }
      await userRepository.save(user);
      return user;
    });

    if (!result) throw new UnauthorizedException(genericLoginMessage);
    return result;
  }

  async createAuthenticatedSession(
    manager: EntityManager,
    user: AdminUserEntity,
    mfaVerifiedAt: Date
  ) {
    if (!user.is_active || !user.mfa_enabled || !user.mfa_secret_ciphertext) {
      throw new UnauthorizedException("Multi-factor authentication is required");
    }
    const created = await this.createSession(
      manager.getRepository(AdminSessionEntity),
      user,
      { mfaVerifiedAt }
    );
    return this.issueResult(user, created.session, created.refreshToken);
  }

  async refresh(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);
    const outcome = await this.dataSource.transaction<RefreshOutcome>(async (manager) => {
      const sessionRepository = manager.getRepository(AdminSessionEntity);
      const userRepository = manager.getRepository(AdminUserEntity);
      const sessionReference = await sessionRepository.findOneBy({ id: parsed.sessionId });
      if (!sessionReference) return { kind: "invalid" };

      const user = await userRepository.findOne({
        where: { id: sessionReference.admin_user_id },
        lock: { mode: "pessimistic_write" }
      });
      const session = await sessionRepository.findOne({
        where: { id: parsed.sessionId, admin_user_id: sessionReference.admin_user_id },
        lock: { mode: "pessimistic_write" }
      });

      if (!user || !session || !this.matchesSecret(session.token_hash, parsed.secret)) {
        return { kind: "invalid" };
      }

      if (session.revoked_at) {
        if (session.revocation_reason === "rotated" && session.rotated_to_session_id) {
          await this.revokeFamily(sessionRepository, session.family_id, "reuse_detected");
          return { kind: "reuse" };
        }
        return { kind: "invalid" };
      }

      const now = new Date();
      if (!user.is_active || user.role !== "admin") {
        await this.revokeSession(sessionRepository, session, "owner_disabled", now);
        return { kind: "invalid" };
      }
      if (!user.mfa_enabled || !session.mfa_verified_at) {
        await this.revokeSession(sessionRepository, session, "mfa_enrollment_required", now);
        return { kind: "invalid" };
      }
      if (
        session.expires_at.getTime() <= now.getTime()
        || session.family_expires_at.getTime() <= now.getTime()
        || session.compromised_at
      ) {
        await this.revokeSession(sessionRepository, session, "expired", now);
        return { kind: "invalid" };
      }

      session.revoked_at = now;
      session.revocation_reason = "rotated";
      session.last_used_at = now;
      await sessionRepository.save(session);

      const created = await this.createSession(sessionRepository, user, {
        familyId: session.family_id,
        familyExpiresAt: session.family_expires_at,
        parentSessionId: session.id,
        mfaVerifiedAt: session.mfa_verified_at
      });
      session.rotated_to_session_id = created.session.id;
      await sessionRepository.save(session);

      return { kind: "success", user, created };
    });

    if (outcome.kind !== "success") {
      throw new UnauthorizedException(
        outcome.kind === "reuse"
          ? "Refresh token reuse was detected; sign in again"
          : "Refresh session is invalid or expired"
      );
    }

    return this.issueResult(
      outcome.user,
      outcome.created.session,
      outcome.created.refreshToken
    );
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    let parsed: { sessionId: string; secret: string };
    try {
      parsed = this.parseRefreshToken(refreshToken);
    } catch {
      // Logout is deliberately idempotent and never discloses session existence.
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(AdminSessionEntity);
      const sessionReference = await sessionRepository.findOneBy({ id: parsed.sessionId });
      if (!sessionReference) return;

      const user = await manager.getRepository(AdminUserEntity).findOne({
        where: { id: sessionReference.admin_user_id },
        lock: { mode: "pessimistic_write" }
      });
      if (!user) return;

      const session = await sessionRepository.findOne({
        where: { id: parsed.sessionId, admin_user_id: user.id },
        lock: { mode: "pessimistic_write" }
      });
      if (!session || !this.matchesSecret(session.token_hash, parsed.secret)) return;

      await this.revokeActiveFamily(sessionRepository, session.family_id, "logout");
    });
  }

  async logoutAll(adminUserId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(AdminUserEntity).findOne({
        where: { id: adminUserId },
        lock: { mode: "pessimistic_write" }
      });
      if (!user) return;

      await manager.getRepository(AdminSessionEntity).createQueryBuilder()
        .update(AdminSessionEntity)
        .set({
          revoked_at: new Date(),
          revocation_reason: "logout_all"
        })
        .where("admin_user_id = :adminUserId", { adminUserId })
        .andWhere("revoked_at IS NULL")
        .execute();
    });
  }

  async listSessions(
    adminUserId: string,
    currentSessionId: string
  ): Promise<AdminSessionSummary[]> {
    const sessions = await this.sessions.find({
      where: {
        admin_user_id: adminUserId,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
        family_expires_at: MoreThan(new Date()),
        mfa_verified_at: Not(IsNull())
      },
      order: { created_at: "DESC" },
      take: 20
    });

    return sessions.map((session) => ({
      id: session.id,
      current: session.id === currentSessionId,
      created_at: session.created_at,
      last_used_at: session.last_used_at,
      expires_at: session.expires_at,
      family_expires_at: session.family_expires_at,
      mfa_verified_at: session.mfa_verified_at as Date
    }));
  }

  async verifyAccessToken(token: string): Promise<AdminPrincipal> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ["HS256"],
        issuer: this.config.get("JWT_ACCESS_ISSUER", { infer: true }),
        audience: this.config.get("JWT_ACCESS_AUDIENCE", { infer: true })
      });
    } catch {
      throw new UnauthorizedException("Access token is invalid or expired");
    }

    if (payload.ver !== adminAccessTokenVersion || payload.role !== "admin") {
      throw new UnauthorizedException("Access token version is no longer accepted");
    }

    const now = new Date();
    const session = await this.sessions.findOne({
      where: {
        id: payload.sid,
        admin_user_id: payload.sub,
        expires_at: MoreThan(now),
        family_expires_at: MoreThan(now)
      },
      relations: { user: true }
    });

    if (
      !session
      || session.revoked_at
      || session.compromised_at
      || !session.mfa_verified_at
      || !session.user?.is_active
      || !session.user.mfa_enabled
      || session.user.role !== "admin"
    ) {
      throw new UnauthorizedException("Admin session is no longer active");
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      session_id: session.id
    };
  }

  private async recordFailedLogin(adminUserId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AdminUserEntity);
      const user = await repository.findOne({
        where: { id: adminUserId },
        lock: { mode: "pessimistic_write" }
      });
      if (!user || !user.is_active) return;

      const now = new Date();
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
      await repository.save(user);
    });
  }

  private async createSession(
    repository: Repository<AdminSessionEntity>,
    user: AdminUserEntity,
    existingFamily?: {
      familyId?: string;
      familyExpiresAt?: Date;
      parentSessionId?: string;
      mfaVerifiedAt: Date | null;
    }
  ): Promise<CreatedSession> {
    const secret = randomBytes(48).toString("base64url");
    const now = Date.now();
    const rollingDays = this.config.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });
    const absoluteDays = this.config.get("REFRESH_TOKEN_ABSOLUTE_TTL_DAYS", { infer: true });
    const familyExpiresAt = existingFamily?.familyExpiresAt
      ?? new Date(now + absoluteDays * millisecondsPerDay);
    const expiresAt = new Date(Math.min(
      now + rollingDays * millisecondsPerDay,
      familyExpiresAt.getTime()
    ));
    if (expiresAt.getTime() <= now) {
      throw new UnauthorizedException("Refresh session family has expired");
    }

    const session = repository.create({
      admin_user_id: user.id,
      family_id: existingFamily?.familyId ?? randomUUID(),
      parent_session_id: existingFamily?.parentSessionId ?? null,
      rotated_to_session_id: null,
      token_hash: this.hashSecret(secret),
      expires_at: expiresAt,
      family_expires_at: familyExpiresAt,
      revoked_at: null,
      revocation_reason: null,
      compromised_at: null,
      last_used_at: null,
      mfa_verified_at: existingFamily?.mfaVerifiedAt ?? null
    });
    const saved = await repository.save(session);
    return { session: saved, refreshToken: `${saved.id}.${secret}` };
  }

  private issueResult(
    user: AdminUserEntity,
    session: AdminSessionEntity,
    refreshToken: string
  ) {
    const expiresIn = this.config.get("JWT_ACCESS_TTL_SECONDS", { infer: true });
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
      ver: adminAccessTokenVersion
    };

    return {
      accessToken: this.jwt.sign(payload, {
        algorithm: "HS256",
        audience: this.config.get("JWT_ACCESS_AUDIENCE", { infer: true }),
        issuer: this.config.get("JWT_ACCESS_ISSUER", { infer: true }),
        jwtid: randomUUID(),
        expiresIn
      }),
      refreshToken,
      accessTokenMaxAgeMs: expiresIn * 1_000,
      refreshTokenMaxAgeMs: Math.max(0, session.expires_at.getTime() - Date.now()),
      user: { id: user.id, email: user.email, role: user.role }
    };
  }

  private parseRefreshToken(token: string) {
    const [sessionId, secret, ...rest] = token.split(".");
    if (
      !sessionId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
      || !secret
      || secret.length < 48
      || rest.length > 0
    ) {
      throw new UnauthorizedException("Refresh session is invalid");
    }
    return { sessionId, secret };
  }

  private async revokeSession(
    repository: Repository<AdminSessionEntity>,
    session: AdminSessionEntity,
    reason: SessionRevocationReason,
    revokedAt: Date
  ): Promise<void> {
    session.revoked_at = session.revoked_at ?? revokedAt;
    session.revocation_reason = session.revocation_reason ?? reason;
    await repository.save(session);
  }

  private async revokeFamily(
    repository: Repository<AdminSessionEntity>,
    familyId: string,
    reason: "reuse_detected"
  ): Promise<void> {
    const now = new Date();
    await repository.createQueryBuilder()
      .update(AdminSessionEntity)
      .set({
        revoked_at: now,
        revocation_reason: reason,
        compromised_at: now
      })
      .where("family_id = :familyId", { familyId })
      .execute();
  }

  private async revokeActiveFamily(
    repository: Repository<AdminSessionEntity>,
    familyId: string,
    reason: "logout"
  ): Promise<void> {
    await repository.createQueryBuilder()
      .update(AdminSessionEntity)
      .set({
        revoked_at: new Date(),
        revocation_reason: reason
      })
      .where("family_id = :familyId", { familyId })
      .andWhere("revoked_at IS NULL")
      .execute();
  }

  private matchesSecret(expectedHash: string, secret: string): boolean {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(this.hashSecret(secret), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashSecret(secret: string): string {
    // Refresh secrets are 384 random bits, never user-chosen passwords.
    // codeql[js/insufficient-password-hash]
    return createHash("sha256").update(secret).digest("hex");
  }
}
