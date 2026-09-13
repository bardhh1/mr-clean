import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminUserEntity } from "../src/admin/entities/admin-user.entity";
import { hashPassword } from "../src/admin/auth/password";
import { hashBootstrapToken, totpCode } from "../src/admin/auth/mfa";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/configure-application";

const ownerEmail = "owner-auth-e2e@example.invalid";
const ownerPassword = "e2e-owner-password-with-enough-entropy";
const trustedClient = { "x-mr-clean-client": "mr-clean-web-v1" };
const browserOrigin = "http://localhost:5173";
const bootstrapToken = "Ym9vdHN0cmFwLXRva2VuLXRlc3QtdmFsdWUtMzIhISE";

type MfaChallengeBody = {
  challengeToken: string;
  mode: "bootstrap" | "enroll" | "verify";
  setup?: { secret: string };
};

type MfaVerificationBody = {
  recovery_codes?: string[];
};

type AdminProduct = {
  id: string;
  is_active: boolean;
  requires_quote: boolean;
  stock_label: string;
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
      last_totp_counter: null,
      mfa_bootstrap_token_hash: hashBootstrapToken(bootstrapToken),
      mfa_bootstrap_expires_at: new Date(Date.now() + 15 * 60_000)
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
    await request(server)
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(403);
    await request(server)
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .set("Origin", "https://mr-clean.example.evil.test")
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(403);

    const bootstrap = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    expect(bootstrap.body).toMatchObject({ status: "mfa_required", mode: "bootstrap" });
    expect((bootstrap.body as MfaChallengeBody).setup).toBeUndefined();
    expect(bootstrap.headers["cache-control"]).toBe("no-store");
    const bootstrapBody = bootstrap.body as MfaChallengeBody;
    const enrollment = await browser
      .post("/api/v1/admin/auth/mfa/bootstrap")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({
        challenge_token: bootstrapBody.challengeToken,
        bootstrap_token: bootstrapToken
      })
      .expect(200);
    expect(enrollment.body).toMatchObject({ status: "mfa_required", mode: "enroll" });
    const enrollmentBody = enrollment.body as MfaChallengeBody;
    if (!enrollmentBody.setup) throw new Error("Enrollment secret was not returned");
    const enrolled = await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({
        challenge_token: enrollmentBody.challengeToken,
        code: totpCode(enrollmentBody.setup.secret)
      })
      .expect(200);
    expect(enrolled.headers["cache-control"]).toBe("no-store");
    const recoveryCodes = (enrolled.body as MfaVerificationBody).recovery_codes ?? [];
    expect(recoveryCodes).toHaveLength(10);
    const originalRefreshCookie = cookiePair(enrolled.headers["set-cookie"], "mr_clean_refresh");
    const originalCsrfCookie = cookiePair(enrolled.headers["set-cookie"], "mr_clean_csrf");
    const originalCsrfToken = originalCsrfCookie.split("=", 2)[1] ?? "";
    expect(originalCsrfCookie).toContain("mr_clean_csrf=v1.");
    const setCookies = setCookieHeaders(enrolled.headers["set-cookie"]);
    expect(setCookies.find((value) => value.startsWith("mr_clean_access=")))
      .toContain("HttpOnly");
    expect(setCookies.find((value) => value.startsWith("mr_clean_refresh=")))
      .toContain("Priority=High");
    expect(setCookies.find((value) => value.startsWith("mr_clean_csrf=")))
      .not.toContain("HttpOnly");

    await browser
      .post("/api/v1/admin/auth/logout-all")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .expect(403);
    await browser
      .post("/api/v1/admin/auth/logout-all")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", `${originalCsrfToken}tampered`)
      .expect(403);

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
      .set("Origin", browserOrigin)
      .set("x-csrf-token", originalCsrfToken)
      .expect(200);

    await request(server)
      .post("/api/v1/admin/auth/refresh")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", originalCsrfToken)
      .set("Cookie", `${originalRefreshCookie}; ${originalCsrfCookie}`)
      .expect(401);

    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);

    const logoutChallenge = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    expect(logoutChallenge.body).toMatchObject({ mode: "verify" });
    const logoutChallengeBody = logoutChallenge.body as MfaChallengeBody;
    const logoutLogin = await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({
        challenge_token: logoutChallengeBody.challengeToken,
        code: recoveryCodes[0]
      })
      .expect(200);
    const logoutParentCookie = cookiePair(
      logoutLogin.headers["set-cookie"],
      "mr_clean_refresh"
    );
    const logoutCsrfCookie = cookiePair(logoutLogin.headers["set-cookie"], "mr_clean_csrf");
    const logoutCsrfToken = logoutCsrfCookie.split("=", 2)[1] ?? "";
    await browser
      .post("/api/v1/admin/auth/refresh")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", logoutCsrfToken)
      .expect(200);
    await request(server)
      .post("/api/v1/admin/auth/logout")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", logoutCsrfToken)
      .set("Cookie", `${logoutParentCookie}; ${logoutCsrfCookie}`)
      .expect(204);
    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);

    const finalChallenge = await browser
      .post("/api/v1/admin/auth/login")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);
    const finalChallengeBody = finalChallenge.body as MfaChallengeBody;
    const finalLogin = await browser
      .post("/api/v1/admin/auth/mfa/verify")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .send({
        challenge_token: finalChallengeBody.challengeToken,
        code: recoveryCodes[1]
      })
      .expect(200);
    const finalCsrfCookie = cookiePair(finalLogin.headers["set-cookie"], "mr_clean_csrf");
    const finalCsrfToken = finalCsrfCookie.split("=", 2)[1] ?? "";

    const products = await browser
      .get("/api/v1/admin/products")
      .set(trustedClient)
      .expect(200);
    const product = (products.body as AdminProduct[]).find(
      (candidate) => candidate.is_active && !candidate.requires_quote
    );
    if (!product) {
      throw new Error("The migrated catalog has no directly orderable product for audit verification");
    }
    await browser
      .patch(`/api/v1/admin/products/${product.id}`)
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", finalCsrfToken)
      .send({ stock_label: product.stock_label })
      .expect(200);

    const createdOrder = await browser
      .post("/api/v1/orders")
      .send({
        idempotency_key: randomTestUuid(),
        customer_name: "Phase 10 Audit Verification",
        phone: "+38344111222",
        city: "Prishtinë",
        address: "Disposable PostgreSQL test",
        payment_preference: "cash",
        items: [{ product_id: product.id, quantity: 1 }]
      })
      .expect(201);
    const createdOrderId = (createdOrder.body as { id: string }).id;
    await browser
      .patch(`/api/v1/admin/orders/${createdOrderId}/status`)
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", finalCsrfToken)
      .send({ status: "confirmed" })
      .expect(200);

    await browser
      .post("/api/v1/admin/auth/logout-all")
      .set(trustedClient)
      .set("Origin", browserOrigin)
      .set("x-csrf-token", finalCsrfToken)
      .expect(204);
    await browser
      .get("/api/v1/admin/auth/me")
      .expect(401);

    const auditRows = await database.query<Array<{
      id: string;
      action: string;
      outcome: string;
    }>>(`
      SELECT id, action, outcome
      FROM admin_audit_events
      ORDER BY occurred_at ASC
    `);
    expect(auditRows.map((event) => event.action)).toEqual(expect.arrayContaining([
      "auth.login.succeeded",
      "auth.session.refreshed",
      "auth.refresh.reuse_detected",
      "auth.logout",
      "auth.logout_all",
      "catalog.product.updated",
      "orders.status_updated"
    ]));
    expect(auditRows.every((event) => ["success", "failure"].includes(event.outcome)))
      .toBe(true);
    const immutableId = auditRows[0]?.id;
    if (!immutableId) throw new Error("Authentication audit events were not written");
    await expect(database.query(
      `UPDATE admin_audit_events SET action = 'auth.changed' WHERE id = $1`,
      [immutableId]
    )).rejects.toThrow("append-only");
    await expect(database.query(
      `DELETE FROM admin_audit_events WHERE id = $1`,
      [immutableId]
    )).rejects.toThrow("append-only");
    await database.query(`DELETE FROM orders WHERE id = $1`, [createdOrderId]);
  });
});

function cookiePair(
  header: string | string[] | undefined,
  name: string
): string {
  const cookies = setCookieHeaders(header);
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`${name} cookie was not returned`);
  return cookie.split(";", 1)[0] ?? cookie;
}

function setCookieHeaders(header: unknown): string[] {
  if (typeof header === "string") return [header];
  if (Array.isArray(header) && header.every((value) => typeof value === "string")) {
    return header;
  }
  return [];
}

function randomTestUuid(): string {
  return randomUUID();
}
