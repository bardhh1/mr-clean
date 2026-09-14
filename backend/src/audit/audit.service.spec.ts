import type { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../config/env.validation";
import { AuditService } from "./audit.service";
import { AdminAuditEventEntity } from "./entities/admin-audit-event.entity";

describe("AuditService", () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const repository = {
    create: (value: Partial<AdminAuditEventEntity>) => value,
    save
  } as unknown as Repository<AdminAuditEventEntity>;
  const manager = {
    getRepository: () => repository
  } as unknown as EntityManager;
  const dataSource = { manager } as DataSource;
  const config = {
    get: () => "YXVkaXQtdGVzdC1oYXNoLWtleS12YWx1ZS0zMiEhISE"
  } as unknown as ConfigService<AppEnvironment, true>;
  const service = new AuditService(dataSource, config);

  it("pseudonymizes network identifiers and bounds request metadata", () => {
    const request = {
      headers: { "x-real-ip": "203.0.113.8" },
      header: (name: string) => name === "user-agent" ? `agent\r\n${"x".repeat(600)}` : undefined,
      requestId: "request-1"
    } as unknown as Request;
    const context = service.context(request, {
      id: "11111111-1111-4111-8111-111111111111",
      email: "owner@example.com",
      role: "admin",
      session_id: "22222222-2222-4222-8222-222222222222"
    });

    expect(context.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(context.ipHash).not.toContain("203.0.113.8");
    expect(context.userAgent).not.toContain("\n");
    expect(context.userAgent).toHaveLength(512);
  });

  it("inserts an immutable event shape through the supplied transaction manager", async () => {
    await service.record({
      actorAdminUserId: null,
      sessionId: null,
      requestId: "request-1",
      ipHash: null,
      userAgent: null,
      action: "auth.login.failed",
      outcome: "failure",
      metadata: { stage: "password" }
    }, manager);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.login.failed",
      outcome: "failure",
      metadata: { stage: "password" }
    }));
  });
});
