import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Server } from "node:http";
import request from "supertest";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminUserEntity } from "../src/admin/entities/admin-user.entity";
import { hashPassword } from "../src/admin/auth/password";
import { totpCode } from "../src/admin/auth/mfa";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/configure-application";

const ownerEmail = "owner-auth-e2e@example.invalid";
const ownerPassword = "e2e-owner-password-with-enough-entropy";
const trustedClient = { "x-mr-clean-client": "mr-clean-web-v1" };

type MfaChallengeBody = {
  challengeToken: string;
  mode: "enroll" | "verify";
  setup?: { secret: string };
};

type MfaVerificationBody = {
  recovery_codes?: string[];
};

describe("Single-owner authentication (e2e)", () => {
  let app: INestApplication;
  let server: Server;
  let database: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;
    database = app.get(DataSource);

    const repository = database.getRepository(AdminUserEntity);
    await repository.delete({ email: ownerEmail });
    await repository.save(repository.create({
      email: ownerEmail,
      password_hash: hashPassword(ownerPassword),
      role: "admin",
      is_active: true,
      failed_login_count: 0,
      last_failed_login_at: null,
      locked_until: null,
      password_changed_at: new Date(),
      last_login_at: null,
      mfa_enabled: false,
      mfa_secret_ciphertext: null,
      mfa_enrolled_at: null,
      last_totp_counter: null
    }));
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.getRepository(AdminUserEntity).delete({ email: ownerEmail });
    }
    await app?.close();
  });

  it("rotates cookies, contains refresh replay, and revokes all sessions", async () => {
    const browser = request.agent(server);
    const enrollment = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    expect(enrollment.body).toMatchObject({ status: "mfa_required", mode: "enroll" });
    expect(enrollment.headers["cache-control"]).toBe("no-store");
    const enrollmentBody = enrollment.body as MfaChallengeBody;
    if (!enrollmentBody.setup) throw new Error("Enrollment secret was not returned");
    const enrolled = await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .send({
        challenge_token: enrollmentBody.challengeToken,
        code: totpCode(enrollmentBody.setup.secret)
      })
      .expect(200);
    expect(enrolled.headers["cache-control"]).toBe("no-store");
    const recoveryCodes = (enrolled.body as MfaVerificationBody).recovery_codes ?? [];
    expect(recoveryCodes).toHaveLength(10);
    const originalRefreshCookie = cookiePair(enrolled.headers["set-cookie"], "mr_clean_refresh");

    const activeSessions = await browser
      .get("/api/v1/admin/auth/sessions")
      .set(trustedClient)
      .expect(200);
    expect(activeSessions.body).toEqual([
      expect.objectContaining({ current: true })
    ]);

    await browser
      .post("/api/v1/admin/auth/refresh")
      .set(trustedClient)
      .expect(200);

    await request(server)
      .post("/api/v1/admin/auth/refresh")
      .set(trustedClient)
      .set("Cookie", originalRefreshCookie)
      .expect(401);

    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);

    const logoutChallenge = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    expect(logoutChallenge.body).toMatchObject({ mode: "verify" });
    const logoutChallengeBody = logoutChallenge.body as MfaChallengeBody;
    const logoutLogin = await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .send({
        challenge_token: logoutChallengeBody.challengeToken,
        code: recoveryCodes[0]
      })
      .expect(200);
    const logoutParentCookie = cookiePair(
      logoutLogin.headers["set-cookie"],
      "mr_clean_refresh"
    );
    await browser
      .post("/api/v1/admin/auth/refresh")
      .set(trustedClient)
      .expect(200);
    await request(server)
      .post("/api/v1/admin/auth/logout")
      .set(trustedClient)
      .set("Cookie", logoutParentCookie)
      .expect(204);
    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);

    const finalChallenge = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    const finalChallengeBody = finalChallenge.body as MfaChallengeBody;
    await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .send({
        challenge_token: finalChallengeBody.challengeToken,
        code: recoveryCodes[1]
      })
      .expect(200);
    await browser
      .post("/api/v1/admin/auth/logout-all")
      .set(trustedClient)
      .expect(204);
    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);
  });
});

function cookiePair(
  header: string | string[] | undefined,
  name: string
): string {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`${name} cookie was not returned`);
  return cookie.split(";", 1)[0] ?? cookie;
}
