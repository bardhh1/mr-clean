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
import { hashBootstrapToken, totpCode } from "./mfa";

const bootstrapToken = "Ym9vdHN0cmFwLXRva2VuLXRlc3QtdmFsdWUtMzIhISE";

const values = {
  MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  MFA_RECOVERY_PEPPER: "cmVjb3ZlcnktcGVwcGVyLXRlc3QtdmFsdWUtMzIhISE",
  MFA_ISSUER: "Mr. Clean Admin",
  MFA_CHALLENGE_TTL_SECONDS: 300,
  MFA_MAX_ATTEMPTS: 5,
  MFA_MAX_ACTIVE_CHALLENGES: 3,
  MFA_BOOTSTRAP_TTL_MINUTES: 15,
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
    countBy: async ({ admin_user_id }: Partial<AdminMfaChallengeEntity>) =>
      this.challenges.filter((challenge) =>
        challenge.admin_user_id === admin_user_id && !challenge.consumed_at
      ).length,
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
        revoked_at: null,
        compromised_at: null,
        expires_at: new Date(Date.now() + 60_000),
        family_expires_at: new Date(Date.now() + 120_000)
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
      last_totp_counter: null,
      mfa_bootstrap_token_hash: null,
      mfa_bootstrap_expires_at: null
    });
    user.mfa_bootstrap_token_hash = hashBootstrapToken(bootstrapToken);
    user.mfa_bootstrap_expires_at = new Date(Date.now() + 15 * 60_000);
    this.users.push(user);
    return user;
  }

  private challengeQueryBuilder() {
    let adminUserId = "";
    let now = new Date(0);
    const builder = {
      delete: () => builder,
      from: () => builder,
      where: (_clause: string, parameters: { adminUserId: string }) => {
        adminUserId = parameters.adminUserId;
        return builder;
      },
      andWhere: (_clause: string, parameters: { now: Date }) => {
        now = parameters.now;
        return builder;
      },
      execute: async () => {
        const kept = this.challenges.filter((challenge) =>
          challenge.admin_user_id !== adminUserId
          || (!challenge.consumed_at && challenge.expires_at.getTime() > now.getTime())
        );
        const affected = this.challenges.length - kept.length;
        this.challenges.splice(0, this.challenges.length, ...kept);
        return { affected, raw: [] };
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

  async function beginEnrollment(owner: AdminUserEntity) {
    const authorization = await service.begin(owner);
    expect(authorization.mode).toBe("bootstrap");
    expect(authorization.setup).toBeUndefined();
    return service.bootstrap(authorization.challengeToken, bootstrapToken);
  }

  it("requires an independent bootstrap token before exposing enrollment material", async () => {
    const owner = fixture.owner();
    const authorization = await service.begin(owner);

    expect(authorization).toMatchObject({ mode: "bootstrap" });
    expect(authorization.setup).toBeUndefined();
    await expect(service.bootstrap(
      authorization.challengeToken,
      "b3BlcmF0b3ItYm9vdHN0cmFwLXRva2VuLXZhbHVlISE"
    )).rejects.toThrow("invalid");

    const enrollment = await service.bootstrap(authorization.challengeToken, bootstrapToken);
    expect(enrollment.mode).toBe("enroll");
    expect(enrollment.setup?.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(owner.mfa_bootstrap_token_hash).toBeNull();
    expect(owner.mfa_bootstrap_expires_at).toBeNull();
    await expect(service.bootstrap(authorization.challengeToken, bootstrapToken))
      .rejects.toThrow("invalid");
  });

  it("rejects expired and cross-challenge bootstrap replay", async () => {
    const owner = fixture.owner();
    const first = await service.begin(owner);
    const second = await service.begin(owner);

    const enrollment = await service.bootstrap(first.challengeToken, bootstrapToken);
    expect(enrollment.mode).toBe("enroll");
    await expect(service.bootstrap(second.challengeToken, bootstrapToken))
      .rejects.toThrow("invalid");

    const anotherOwner = fixture.owner();
    anotherOwner.email = "second-owner-test@example.com";
    anotherOwner.mfa_bootstrap_expires_at = new Date(Date.now() - 1);
    const expired = await service.begin(anotherOwner);
    await expect(service.bootstrap(expired.challengeToken, bootstrapToken))
      .rejects.toThrow("invalid");
  });

  it("enrolls MFA, encrypts the secret, and returns recovery codes once", async () => {
    const owner = fixture.owner();
    const challenge = await beginEnrollment(owner);
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
    const challenge = await beginEnrollment(fixture.owner());
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
    const enrollment = await beginEnrollment(owner);
    await service.complete(
      enrollment.challengeToken,
      totpCode(enrollment.setup?.secret ?? "")
    );
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
    const enrollment = await beginEnrollment(owner);
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
    const enrollment = await beginEnrollment(owner);
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

  it("rejects recovery-code regeneration from a compromised session", async () => {
    const owner = fixture.owner();
    const enrollment = await beginEnrollment(owner);
    await service.complete(
      enrollment.challengeToken,
      totpCode(enrollment.setup?.secret ?? "")
    );
    const session = fixture.sessions[0];
    session.compromised_at = new Date();

    await expect(service.regenerateRecoveryCodes(
      owner.id,
      session.id,
      totpCode(enrollment.setup?.secret ?? "", Date.now() + 30_000)
    )).rejects.toThrow("invalid");
  });

  it("invalidates a challenge when the password changes", async () => {
    const owner = fixture.owner();
    const challenge = await beginEnrollment(owner);
    owner.password_changed_at = new Date(owner.password_changed_at.getTime() + 1_000);
    await expect(service.complete(
      challenge.challengeToken,
      totpCode(challenge.setup?.secret ?? "")
    )).rejects.toThrow("invalid");
  });

  it("preserves concurrent MFA challenges and enforces the owner-scoped cap", async () => {
    const owner = fixture.owner();
    const enrollment = await beginEnrollment(owner);
    await service.complete(
      enrollment.challengeToken,
      totpCode(enrollment.setup?.secret ?? "")
    );

    const first = await service.begin(owner);
    const second = await service.begin(owner);
    const third = await service.begin(owner);

    expect(fixture.challenges.find((challenge) =>
      first.challengeToken.startsWith(`${challenge.id}.`)
    )?.consumed_at).toBeNull();
    expect(second.mode).toBe("verify");
    expect(third.mode).toBe("verify");
    await expect(service.begin(owner)).rejects.toMatchObject({ status: 429 });
  });

  it("prunes expired and consumed challenge rows before evaluating the cap", async () => {
    const owner = fixture.owner();
    const expired = Object.assign(new AdminMfaChallengeEntity(), {
      id: randomUUID(),
      admin_user_id: owner.id,
      purpose: "bootstrap" as const,
      token_hash: "0".repeat(64),
      pending_secret_ciphertext: null,
      password_changed_at: owner.password_changed_at,
      failed_attempts: 0,
      expires_at: new Date(Date.now() - 1),
      consumed_at: null,
      created_at: new Date()
    });
    const consumed = Object.assign(new AdminMfaChallengeEntity(), {
      ...expired,
      id: randomUUID(),
      expires_at: new Date(Date.now() + 60_000),
      consumed_at: new Date()
    });
    fixture.challenges.push(expired, consumed);

    await expect(service.begin(owner)).resolves.toMatchObject({ mode: "bootstrap" });
    expect(fixture.challenges.some((challenge) => challenge.id === expired.id)).toBe(false);
    expect(fixture.challenges.some((challenge) => challenge.id === consumed.id)).toBe(false);
  });
});
