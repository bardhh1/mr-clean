import { JwtService } from "@nestjs/jwt";
import type { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminSessionEntity } from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import { AdminAuthService } from "./admin-auth.service";
import { hashPassword } from "./password";

const configuration: Record<keyof AppEnvironment, AppEnvironment[keyof AppEnvironment]> = {
  NODE_ENV: "test",
  PORT: 3000,
  API_PREFIX: "api/v1",
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  DATABASE_SSL: false,
  DATABASE_POOL_MAX: 5,
  JWT_ACCESS_SECRET: "a-test-signing-secret-that-is-longer-than-thirty-two-characters",
  JWT_ACCESS_ISSUER: "mr-clean-api",
  JWT_ACCESS_AUDIENCE: "mr-clean-admin",
  JWT_ACCESS_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 7,
  REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 30,
  ADMIN_MAX_FAILED_LOGINS: 3,
  ADMIN_LOCKOUT_MINUTES: 15,
  MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  MFA_RECOVERY_PEPPER: "a-test-recovery-pepper-that-is-at-least-32-characters",
  MFA_ISSUER: "Mr. Clean Admin",
  MFA_CHALLENGE_TTL_SECONDS: 300,
  MFA_MAX_ATTEMPTS: 5,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  AWS_ENDPOINT_URL: "https://storage.invalid",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key-value",
  AWS_S3_BUCKET_NAME: "test-product-images",
  AWS_DEFAULT_REGION: "auto",
  AWS_S3_URL_STYLE: "path"
};

type QueryValues = Partial<AdminSessionEntity>;

class AuthFixture {
  readonly users: AdminUserEntity[] = [];
  readonly sessions: AdminSessionEntity[] = [];
  readonly lockEvents: string[] = [];
  readonly jwt = new JwtService({ secret: configuration.JWT_ACCESS_SECRET as string });

  readonly userRepository = {
    findOne: async ({
      where,
      lock
    }: {
      where: Partial<AdminUserEntity>;
      lock?: { mode: string };
    }) => {
      if (lock) this.lockEvents.push("user");
      return this.users.find((user) => matches(user, where)) ?? null;
    },
    findOneBy: async (where: Partial<AdminUserEntity>) =>
      this.users.find((user) => matches(user, where)) ?? null,
    create: (input: Partial<AdminUserEntity>) => Object.assign(new AdminUserEntity(), input),
    save: async (user: AdminUserEntity) => {
      const index = this.users.findIndex((candidate) => candidate.id === user.id);
      if (index === -1) this.users.push(user);
      else this.users[index] = user;
      return user;
    }
  } as unknown as Repository<AdminUserEntity>;

  readonly sessionRepository = {
    findOne: async ({
      where,
      lock
    }: {
      where: Partial<AdminSessionEntity>;
      lock?: { mode: string };
    }) => {
      if (lock) this.lockEvents.push("session");
      const session = this.sessions.find((candidate) => matches(candidate, where)) ?? null;
      if (session) {
        session.user = this.users.find((user) => user.id === session.admin_user_id);
      }
      return session;
    },
    findOneBy: async (where: Partial<AdminSessionEntity>) =>
      this.sessions.find((session) => matches(session, where)) ?? null,
    find: async ({ where, take }: { where: Partial<AdminSessionEntity>; take: number }) =>
      this.sessions
        .filter((session) => session.admin_user_id === where.admin_user_id && !session.revoked_at)
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
        .slice(0, take),
    create: (input: Partial<AdminSessionEntity>) => Object.assign(new AdminSessionEntity(), {
      id: randomUUID(),
      created_at: new Date(),
      ...input
    }),
    save: async (session: AdminSessionEntity) => {
      const index = this.sessions.findIndex((candidate) => candidate.id === session.id);
      if (index === -1) this.sessions.push(session);
      else this.sessions[index] = session;
      return session;
    },
    createQueryBuilder: () => this.queryBuilder()
  } as unknown as Repository<AdminSessionEntity>;

  readonly dataSource = {
    transaction: async <T>(callback: (manager: EntityManager) => Promise<T>) => callback({
      getRepository: (entity: typeof AdminUserEntity | typeof AdminSessionEntity) =>
        entity === AdminUserEntity ? this.userRepository : this.sessionRepository
    } as unknown as EntityManager)
  } as DataSource;

  readonly config = {
    get: (key: keyof AppEnvironment) => configuration[key]
  } as unknown as ConfigService<AppEnvironment, true>;

  service(): AdminAuthService {
    return new AdminAuthService(
      this.userRepository,
      this.sessionRepository,
      this.dataSource,
      this.jwt,
      this.config
    );
  }

  async login(service: AdminAuthService, email: string, password: string) {
    const user = await service.verifyCredentials(email, password);
    return this.dataSource.transaction((manager) =>
      service.createAuthenticatedSession(manager, user, new Date())
    );
  }

  owner(password = "a-very-long-owner-password"): AdminUserEntity {
    const user = Object.assign(new AdminUserEntity(), {
      id: randomUUID(),
      email: "owner@example.com",
      password_hash: hashPassword(password),
      role: "admin" as const,
      is_active: true,
      failed_login_count: 0,
      last_failed_login_at: null,
      locked_until: null,
      password_changed_at: new Date(),
      last_login_at: null,
      mfa_enabled: true,
      mfa_secret_ciphertext: "test-only-encrypted-secret",
      mfa_enrolled_at: new Date(),
      last_totp_counter: null,
      created_at: new Date(),
      updated_at: new Date()
    });
    this.users.push(user);
    return user;
  }

  private queryBuilder() {
    let values: QueryValues = {};
    let where = "";
    let parameters: Record<string, string> = {};
    let activeOnly = false;
    const builder = {
      update: () => builder,
      set: (next: QueryValues) => {
        values = next;
        return builder;
      },
      where: (clause: string, nextParameters: Record<string, string>) => {
        where = clause;
        parameters = { ...parameters, ...nextParameters };
        return builder;
      },
      andWhere: (clause: string) => {
        if (clause.includes("revoked_at IS NULL")) activeOnly = true;
        return builder;
      },
      execute: async () => {
        const targets = this.sessions.filter((session) => {
          if (where.includes("family_id")) {
            return session.family_id === parameters.familyId
              && (!activeOnly || !session.revoked_at);
          }
          if (where.includes("admin_user_id")) {
            return session.admin_user_id === parameters.adminUserId && !session.revoked_at;
          }
          return false;
        });
        for (const target of targets) Object.assign(target, values);
        return { affected: targets.length };
      }
    };
    return builder;
  }
}

function matches<T extends object>(value: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
      return true;
    }
    return value[key as keyof T] === expected;
  });
}

describe("AdminAuthService", () => {
  let fixture: AuthFixture;
  let service: AdminAuthService;

  beforeEach(() => {
    fixture = new AuthFixture();
    service = fixture.service();
  });

  it("creates a bounded session family and a versioned access token", async () => {
    const owner = fixture.owner();
    const result = await fixture.login(service, owner.email, "a-very-long-owner-password");

    expect(fixture.sessions).toHaveLength(1);
    const session = fixture.sessions[0];
    expect(session.family_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.parent_session_id).toBeNull();
    expect(session.family_expires_at.getTime()).toBeGreaterThan(session.expires_at.getTime());
    expect(session.expires_at.getTime() - session.created_at.getTime())
      .toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1_000);

    const payload = await fixture.jwt.verifyAsync<Record<string, unknown>>(result.accessToken, {
      issuer: "mr-clean-api",
      audience: "mr-clean-admin"
    });
    expect(payload).toMatchObject({
      sub: owner.id,
      sid: session.id,
      role: "admin",
      ver: 3
    });
  });

  it("locks the owner account after the configured number of failures", async () => {
    const owner = fixture.owner();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(fixture.login(service, owner.email, "incorrect-password"))
        .rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(owner.failed_login_count).toBe(3);
    expect(owner.locked_until?.getTime()).toBeGreaterThan(Date.now());
    await expect(fixture.login(service, owner.email, "a-very-long-owner-password"))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fixture.sessions).toHaveLength(0);
  });

  it("does not extend an account lock while the lock is active", async () => {
    const owner = fixture.owner();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(fixture.login(service, owner.email, "incorrect-password"))
        .rejects.toBeInstanceOf(UnauthorizedException);
    }
    const deadline = owner.locked_until?.getTime();
    const failures = owner.failed_login_count;

    await expect(fixture.login(service, owner.email, "another-incorrect-password"))
      .rejects.toBeInstanceOf(UnauthorizedException);

    expect(owner.locked_until?.getTime()).toBe(deadline);
    expect(owner.failed_login_count).toBe(failures);
  });

  it("rotates refresh sessions without extending the absolute family lifetime", async () => {
    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    const first = fixture.sessions[0];

    const refreshed = await service.refresh(login.refreshToken);
    const second = fixture.sessions[1];

    expect(first.revocation_reason).toBe("rotated");
    expect(first.rotated_to_session_id).toBe(second.id);
    expect(second.parent_session_id).toBe(first.id);
    expect(second.family_id).toBe(first.family_id);
    expect(second.family_expires_at).toEqual(first.family_expires_at);
    expect(refreshed.refreshToken.startsWith(`${second.id}.`)).toBe(true);
  });

  it("revokes the full family when a rotated refresh token is replayed", async () => {
    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    await service.refresh(login.refreshToken);

    await expect(service.refresh(login.refreshToken)).rejects.toThrow("reuse was detected");
    expect(fixture.sessions).toHaveLength(2);
    expect(fixture.sessions.every((session) => session.revocation_reason === "reuse_detected"))
      .toBe(true);
    expect(fixture.sessions.every((session) => session.compromised_at instanceof Date)).toBe(true);
  });

  it("serializes refresh on the owner before the session row", async () => {
    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    fixture.lockEvents.length = 0;

    await service.refresh(login.refreshToken);

    expect(fixture.lockEvents).toEqual(["user", "session"]);
  });

  it("revokes the active family descendant when logout receives a rotated parent", async () => {
    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    const refreshed = await service.refresh(login.refreshToken);
    const [parent, child] = fixture.sessions;

    await service.logout(login.refreshToken);

    expect(parent.revocation_reason).toBe("rotated");
    expect(child.revocation_reason).toBe("logout");
    await expect(service.verifyAccessToken(refreshed.accessToken))
      .rejects.toThrow("no longer active");
  });

  it("keeps malformed logout idempotent but surfaces database revocation failures", async () => {
    await expect(service.logout("not-a-refresh-token")).resolves.toBeUndefined();

    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    vi.spyOn(fixture.dataSource, "transaction")
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(service.logout(login.refreshToken))
      .rejects.toThrow("database unavailable");
  });

  it("rejects legacy access tokens without the current token version", async () => {
    const owner = fixture.owner();
    const login = await fixture.login(service, owner.email, "a-very-long-owner-password");
    const session = fixture.sessions[0];
    const legacy = fixture.jwt.sign({
      sub: owner.id,
      email: owner.email,
      role: "admin",
      sid: session.id
    }, {
      algorithm: "HS256",
      issuer: "mr-clean-api",
      audience: "mr-clean-admin",
      expiresIn: 900
    });

    await expect(service.verifyAccessToken(legacy)).rejects.toThrow("version");
    await expect(service.verifyAccessToken(login.accessToken)).resolves.toMatchObject({
      id: owner.id,
      session_id: session.id
    });
  });

  it("revokes every active session with logout-all", async () => {
    const owner = fixture.owner();
    await fixture.login(service, owner.email, "a-very-long-owner-password");
    await fixture.login(service, owner.email, "a-very-long-owner-password");

    await service.logoutAll(owner.id);

    expect(fixture.sessions).toHaveLength(2);
    expect(fixture.sessions.every((session) => session.revocation_reason === "logout_all"))
      .toBe(true);
  });

  it("serializes logout-all on the owner row", async () => {
    const owner = fixture.owner();
    await fixture.login(service, owner.email, "a-very-long-owner-password");
    fixture.lockEvents.length = 0;

    await service.logoutAll(owner.id);

    expect(fixture.lockEvents).toEqual(["user"]);
  });
});
