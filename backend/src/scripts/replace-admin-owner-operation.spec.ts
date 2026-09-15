import type { EntityManager } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { AdminMfaChallengeEntity } from "../admin/entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../admin/entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../admin/entities/admin-session.entity";
import { AdminUserEntity } from "../admin/entities/admin-user.entity";
import { replaceAdminOwner } from "./replace-admin-owner-operation";

function fixture(activeEmail = "test-owner@example.com") {
  const current = {
    id: "11111111-1111-4111-8111-111111111111",
    email: activeEmail,
    is_active: true,
    mfa_bootstrap_token_hash: null,
    mfa_bootstrap_expires_at: null
  } as AdminUserEntity;
  const replacement = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "client@example.com"
  } as AdminUserEntity;
  const users = {
    findOne: vi.fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null),
    create: vi.fn(() => replacement),
    save: vi.fn((user: AdminUserEntity) => Promise.resolve(user))
  };
  const deleteChallenges = vi.fn().mockResolvedValue(undefined);
  const deleteRecoveryCodes = vi.fn().mockResolvedValue(undefined);
  const sessionUpdates: Array<Record<string, unknown>> = [];
  const sessionBuilder = () => {
    const builder = {
      update: vi.fn(),
      set: vi.fn((value: Record<string, unknown>) => {
        sessionUpdates.push(value);
        return builder;
      }),
      where: vi.fn(),
      andWhere: vi.fn(),
      execute: vi.fn().mockResolvedValue(undefined)
    };
    builder.update.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    builder.andWhere.mockReturnValue(builder);
    return builder;
  };
  const manager = {
    getRepository(entity: unknown) {
      if (entity === AdminUserEntity) return users;
      if (entity === AdminMfaChallengeEntity) return { delete: deleteChallenges };
      if (entity === AdminMfaRecoveryCodeEntity) return { delete: deleteRecoveryCodes };
      if (entity === AdminSessionEntity) return { createQueryBuilder: sessionBuilder };
      throw new Error("Unexpected repository");
    }
  } as unknown as EntityManager;
  return {
    manager,
    current,
    replacement,
    users,
    deleteChallenges,
    deleteRecoveryCodes,
    sessionUpdates
  };
}

const input = {
  currentEmail: "test-owner@example.com",
  newEmail: "client@example.com",
  passwordHash: "scrypt$test",
  bootstrapTokenHash: "a".repeat(64),
  bootstrapExpiresAt: new Date("2026-09-15T15:15:00.000Z")
};

describe("replaceAdminOwner", () => {
  it("atomically disables the old owner and resets the replacement identity", async () => {
    const test = fixture();
    const now = new Date("2026-09-15T15:00:00.000Z");

    await replaceAdminOwner(test.manager, input, now);

    expect(test.current.is_active).toBe(false);
    expect(test.current).toMatchObject({
      mfa_enabled: false,
      mfa_secret_ciphertext: null,
      mfa_enrolled_at: null,
      last_totp_counter: null
    });
    expect(test.replacement).toMatchObject({
      email: "client@example.com",
      password_hash: "scrypt$test",
      is_active: true,
      mfa_enabled: false,
      mfa_secret_ciphertext: null,
      mfa_bootstrap_token_hash: "a".repeat(64),
      mfa_bootstrap_expires_at: input.bootstrapExpiresAt,
      password_changed_at: now
    });
    expect(test.users.save).toHaveBeenNthCalledWith(1, test.current);
    expect(test.users.save).toHaveBeenNthCalledWith(2, test.replacement);
    expect(test.deleteChallenges).toHaveBeenCalledOnce();
    expect(test.deleteRecoveryCodes).toHaveBeenCalledOnce();
    expect(test.sessionUpdates).toEqual([
      { revoked_at: now, revocation_reason: "owner_disabled" },
      { revoked_at: now, revocation_reason: "password_changed" }
    ]);
  });

  it("does not mutate anything when the asserted current owner does not match", async () => {
    const test = fixture("unexpected@example.com");
    await expect(replaceAdminOwner(test.manager, input))
      .rejects.toThrow("does not match ADMIN_REPLACE_FROM_EMAIL");
    expect(test.users.save).not.toHaveBeenCalled();
  });
});
