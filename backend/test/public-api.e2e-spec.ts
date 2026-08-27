import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/configure-application";

type PublicProduct = {
  id: string;
  price_cents: number;
  requires_quote: boolean;
};

type ProductPage = {
  data: PublicProduct[];
  meta: {
    total: number;
  };
};

type ApiError = {
  statusCode: number;
  message: string | string[];
  path: string;
};

type OrderReceipt = {
  id: string;
  reference: string;
  status: string;
  total_cents: number;
  currency: string;
};

describe("Public API (e2e)", () => {
  let app: INestApplication;
  let server: Server;
  let orderableProduct: PublicProduct;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApplication(app);
    await app.init();
    server = app.getHttpServer() as Server;

    const products = await request(server)
      .get("/api/v1/products?limit=100")
      .expect(200);
    const page = products.body as ProductPage;
    const candidate = page.data.find((product) => !product.requires_quote);
    if (!candidate) throw new Error("The migrated catalog has no directly orderable product");
    orderableProduct = candidate;
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports liveness, readiness, and a correlated request ID", async () => {
    const requestId = `ci-${randomUUID()}`;
    const liveness = await request(server)
      .get("/api/v1/health")
      .set("x-request-id", requestId)
      .expect("x-request-id", requestId)
      .expect(200);

    expect(liveness.body).toMatchObject({ status: "ok", service: "mr-clean-api" });

    const readiness = await request(server)
      .get("/api/v1/health/ready")
      .expect(200);
    expect(readiness.body).toMatchObject({
      status: "ready",
      dependencies: { database: "up" }
    });
  });

  it("serves the migrated catalog through the validated HTTP contract", async () => {
    const categories = await request(server)
      .get("/api/v1/categories")
      .expect(200);
    expect(Array.isArray(categories.body)).toBe(true);
    expect((categories.body as unknown[]).length).toBeGreaterThan(0);

    const products = await request(server)
      .get("/api/v1/products?limit=1&offset=0")
      .expect(200);
    const page = products.body as ProductPage;
    expect(page.data).toHaveLength(1);
    expect(page.meta.total).toBeGreaterThan(0);
  });

  it("allows the configured frontend origin through CORS", async () => {
    await request(server)
      .options("/api/v1/orders")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .expect("access-control-allow-origin", "http://localhost:5173")
      .expect(204);
  });

  it("rejects malformed orders at the global validation boundary", async () => {
    const response = await request(server)
      .post("/api/v1/orders")
      .send({ unexpected: "field" })
      .expect(400);
    const error = response.body as ApiError;

    expect(error).toMatchObject({ statusCode: 400, path: "/api/v1/orders" });
    expect(error.message).toEqual(expect.arrayContaining([
      "property unexpected should not exist"
    ]));
  });

  it("creates an order idempotently and rejects key reuse with a changed request", async () => {
    const idempotencyKey = randomUUID();
    const payload = {
      idempotency_key: idempotencyKey,
      customer_name: "CI Verification",
      company_name: "Mr. Clean CI",
      phone: "+38344111222",
      city: "Prishtinë",
      address: "CI ephemeral database",
      notes: "Deleted with the ephemeral PostgreSQL service",
      payment_preference: "cash",
      items: [{ product_id: orderableProduct.id, quantity: 1 }]
    };

    const created = await request(server)
      .post("/api/v1/orders")
      .send(payload)
      .expect(201);
    const receipt = created.body as OrderReceipt;
    expect(receipt).toMatchObject({
      status: "pending_whatsapp",
      total_cents: orderableProduct.price_cents,
      currency: "EUR"
    });
    expect(receipt.reference).toMatch(/^MC-[A-Z0-9]{12}$/);

    const repeated = await request(server)
      .post("/api/v1/orders")
      .send(payload)
      .expect(201);
    expect((repeated.body as OrderReceipt).id).toBe(receipt.id);

    await request(server)
      .post("/api/v1/orders")
      .send({
        ...payload,
        items: [{ product_id: orderableProduct.id, quantity: 2 }]
      })
      .expect(409);
  });
});
