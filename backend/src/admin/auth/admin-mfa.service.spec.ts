import type { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminMfaChallengeEntity } from "../entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaService } from "./admin-mfa.service";
import { totpCode } from "./mfa";

const values = {
  MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  MFA_RECOVERY_PEPPER: "a-test-recovery-pepper-that-is-at-least-32-characters",
  MFA_ISSUER: "Mr. Clean Admin",
  MFA_CHALLENGE_TTL_SECONDS: 300,
  MFA_MAX_ATTEMPTS: 5,
  ADMIN_MAX_FAILED_LOGINS: 5,
  ADMIN_LOCKOUT_MINUTES: 15
} satisfies Partial<AppEnvironment>;

class MfaFixture {
  readonly users: AdminUserEntity[] = [];
  readonly challenges: AdminMfaChallengeEntity[] = [];
  readonly recoveryCodes: AdminMfaRecoveryCodeEntity[] = [];
  readonly sessions: AdminSessionEntity[] = [];

  readonly userRepository = {
    findOne: async ({ where }: { where: Partial<AdminUserEntity> }) =>
      this.users.find((user) => matches(user, where)) ?? null,
    save: async (user: AdminUserEntity) => user
  } as unknown as Repository<AdminUserEntity>;

  readonly challengeRepository = {
    findOneBy: async (where: Partial<AdminMfaChallengeEntity>) =>
      this.challenges.find((challenge) => matches(challenge, where)) ?? null,
    findOne: async ({ where }: { where: Partial<AdminMfaChallengeEntity> }) =>
      this.challenges.find((challenge) => matches(challenge, where)) ?? null,
    create: (input: Partial<AdminMfaChallengeEntity>) => Object.assign(
      new AdminMfaChallengeEntity(),
      { created_at: new Date(), ...input }
    ),
    save: async (challenge: AdminMfaChallengeEntity) => {
      const index = this.challenges.findIndex((candidate) => candidate.id === challenge.id);
      if (index === -1) this.challenges.push(challenge);
      else this.challenges[index] = challenge;
      return challenge;
    },
    createQueryBuilder: () => this.challengeQueryBuilder()
  } as unknown as Repository<AdminMfaChallengeEntity>;

  readonly recoveryRepository = {
    findOne: async ({ where }: { where: Partial<AdminMfaRecoveryCodeEntity> }) =>
      this.recoveryCodes.find((recovery) =>
        recovery.admin_user_id === where.admin_user_id
        && recovery.code_hash === where.code_hash
        && !recovery.used_at
      ) ?? null,
    create: (input: Partial<AdminMfaRecoveryCodeEntity>) => Object.assign(
      new AdminMfaRecoveryCodeEntity(),
      { id: randomUUID(), created_at: new Date(), ...input }
    ),
    save: async (
      input: AdminMfaRecoveryCodeEntity | AdminMfaRecoveryCodeEntity[]
    ) => {
      const items = Array.isArray(input) ? input : [input];
      for (const recovery of items) {
        const index = this.recoveryCodes.findIndex((candidate) => candidate.id === recovery.id);
        if (index === -1) this.recoveryCodes.push(recovery);
        else this.recoveryCodes[index] = recovery;
      }
      return input;
    },
    delete: async ({ admin_user_id }: { admin_user_id: string }) => {
      const kept = this.recoveryCodes.filter((code) => code.admin_user_id !== admin_user_id);
      this.recoveryCodes.splice(0, this.recoveryCodes.length, ...kept);
      return { raw: [], affected: 0 };
    }
  } as unknown as Repository<AdminMfaRecoveryCodeEntity>;

  readonly sessionRepository = {
    findOne: async ({ where }: { where: Partial<AdminSessionEntity> }) =>
      this.sessions.find((session) => matches(session, where)) ?? null,
    save: async (session: AdminSessionEntity) => session
  } as unknown as Repository<AdminSessionEntity>;

  readonly manager = {
    getRepository: (entity: object) => {
      if (entity === AdminUserEntity) return this.userRepository;
      if (entity === AdminMfaChallengeEntity) return this.challengeRepository;
      if (entity === AdminMfaRecoveryCodeEntity) return this.recoveryRepository;
      return this.sessionRepository;
    }
  } as unknown as EntityManager;

  readonly dataSource = {
    transaction: async <T>(callback: (manager: EntityManager) => Promise<T>) =>
      callback(this.manager)
  } as DataSource;

  readonly config = {
    get: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => values[key]
  } as unknown as ConfigService<AppEnvironment, true>;

  readonly auth = {
    createAuthenticatedSession: async (
      _manager: EntityManager,
      user: AdminUserEntity,
      mfaVerifiedAt: Date
    ) => {
      const session = Object.assign(new AdminSessionEntity(), {
        id: randomUUID(),
        admin_user_id: user.id,
        mfa_verified_at: mfaVerifiedAt,
        revoked_at: null
      });
      this.sessions.push(session);
      return {
        accessToken: "access",
        refreshToken: "refresh",
        accessTokenMaxAgeMs: 1_000,
        refreshTokenMaxAgeMs: 2_000,
        user: { id: user.id, email: user.email, role: user.role }
      };
    }
  } as unknown as AdminAuthService;

  service(): AdminMfaService {
    return new AdminMfaService(this.dataSource, this.config, this.auth);
  }

  owner(): AdminUserEntity {
    const user = Object.assign(new AdminUserEntity(), {
      id: randomUUID(),
      email: "owner@example.com",
      password_hash: "password-hash",
      password_changed_at: new Date(),
      role: "admin" as const,
      is_active: true,
      failed_login_count: 0,
      last_failed_login_at: null,
      locked_until: null,
      last_login_at: null,
      mfa_enabled: false,
      mfa_secret_ciphertext: null,
      mfa_enrolled_at: null,
      last_totp_counter: null
    });
    this.users.push(user);
    return user;
  }

  private challengeQueryBuilder() {
    let consumedAt: Date | null = null;
    let adminUserId = "";
    const builder = {
      update: () => builder,
      set: (valuesToSet: { consumed_at: Date }) => {
        consumedAt = valuesToSet.consumed_at;
        return builder;
      },
      where: (_clause: string, parameters: { adminUserId: string }) => {
        adminUserId = parameters.adminUserId;
        return builder;
      },
      andWhere: () => builder,
      execute: async () => {
        for (const challenge of this.challenges) {
          if (challenge.admin_user_id === adminUserId && !challenge.consumed_at) {
            challenge.consumed_at = consumedAt;
          }
        }
        return { affected: 0, raw: [] };
      }
    };
    return builder;
  }
}

function matches<T extends object>(value: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, expected]) => value[key as keyof T] === expected);
}

describe("AdminMfaService", () => {
  let fixture: MfaFixture;
  let service: AdminMfaService;

  beforeEach(() => {
    fixture = new MfaFixture();
    service = fixture.service();
  });

  it("enrolls MFA, encrypts the secret, and returns recovery codes once", async () => {
    const owner = fixture.owner();
    const challenge = await service.begin(owner);
    expect(challenge.mode).toBe("enroll");
    expect(challenge.setup?.secret).toMatch(/^[A-Z2-7]{32}$/);

    const result = await service.complete(
      challenge.challengeToken,
      totpCode(challenge.setup?.secret ?? "")
    );

    expect(owner.mfa_enabled).toBe(true);
    expect(owner.mfa_secret_ciphertext).not.toContain(challenge.setup?.secret);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(fixture.recoveryCodes).toHaveLength(10);
    expect(fixture.sessions).toHaveLength(1);
    await expect(service.complete(challenge.challengeToken, "000000"))
      .rejects.toThrow("invalid");
  });

  it("consumes a challenge after the configured number of invalid codes", async () => {
    const challenge = await service.begin(fixture.owner());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.complete(challenge.challengeToken, "000000"))
        .rejects.toThrow("invalid");
    }
    expect(fixture.challenges[0].failed_attempts).toBe(5);
    expect(fixture.challenges[0].consumed_at).toBeInstanceOf(Date);
    expect(fixture.users[0].locked_until).toBeInstanceOf(Date);
  });

  it("does not reset the account-wide MFA failure budget with a fresh challenge", async () => {
    const owner = fixture.owner();
    const first = await service.begin(owner);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.complete(first.challengeToken, "000000"))
        .rejects.toThrow("invalid");
    }

    const second = await service.begin(owner);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(service.complete(second.challengeToken, "000000"))
        .rejects.toThrow("invalid");
    }

    expect(owner.failed_login_count).toBe(5);
    expect(owner.locked_until).toBeInstanceOf(Date);
    await expect(service.begin(owner)).rejects.toThrow("invalid");
  });

  it("accepts each recovery code only once", async () => {
    const owner = fixture.owner();
    const enrollment = await service.begin(owner);
    const enrolled = await service.complete(
      enrollment.challengeToken,
      totpCode(enrollment.setup?.secret ?? "")
    );
    const recoveryCode = enrolled.recoveryCodes?.[0] ?? "";

    const firstLogin = await service.begin(owner);
    await expect(service.complete(firstLogin.challengeToken, recoveryCode)).resolves.toMatchObject({
      usedRecoveryCode: true
    });
    const secondLogin = await service.begin(owner);
    await expect(service.complete(secondLogin.challengeToken, recoveryCode))
      .rejects.toThrow("invalid");
  });

  it("applies the owner lockout budget to recovery-code regeneration", async () => {
    const owner = fixture.owner();
    const enrollment = await service.begin(owner);
    await service.complete(
      enrollment.challengeToken,
      totpCode(enrollment.setup?.secret ?? "")
    );
    const session = fixture.sessions[0];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.regenerateRecoveryCodes(owner.id, session.id, "000000"))
        .rejects.toThrow("invalid");
    }

    expect(owner.locked_until).toBeInstanceOf(Date);
    await expect(service.regenerateRecoveryCodes(
      owner.id,
      session.id,
      totpCode(enrollment.setup?.secret ?? "", Date.now() + 30_000)
    )).rejects.toThrow("invalid");
  });

  it("invalidates a challenge when the password changes", async () => {
    const owner = fixture.owner();
    const challenge = await service.begin(owner);
    owner.password_changed_at = new Date(owner.password_changed_at.getTime() + 1_000);
    await expect(service.complete(
      challenge.challengeToken,
      totpCode(challenge.setup?.secret ?? "")
    )).rejects.toThrow("invalid");
  });
});
