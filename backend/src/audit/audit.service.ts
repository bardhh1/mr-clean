import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { Request } from "express";
import { DataSource, type EntityManager } from "typeorm";
import type { AdminPrincipal } from "../admin/auth/auth.types";
import { requestTracker } from "../common/guards/railway-throttler.guard";
import type { AppEnvironment } from "../config/env.validation";
import { AdminAuditEventEntity } from "./entities/admin-audit-event.entity";

export type AuditContext = {
  actorAdminUserId: string | null;
  sessionId: string | null;
  requestId: string | null;
  ipHash: string | null;
  userAgent: string | null;
};

export const emptyAuditContext: AuditContext = {
  actorAdminUserId: null,
  sessionId: null,
  requestId: null,
  ipHash: null,
  userAgent: null
};

export type AuditEvent = AuditContext & {
  action: string;
  outcome?: "success" | "failure";
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly key: Buffer;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService<AppEnvironment, true>
  ) {
    this.key = Buffer.from(String(config.get("AUDIT_HMAC_KEY", { infer: true })), "base64url");
  }

  context(request: Request, principal: AdminPrincipal | undefined = request.admin): AuditContext {
    const userAgent = request.header("user-agent")?.replace(/[\r\n]/g, " ").trim();
    return {
      actorAdminUserId: principal?.id ?? null,
      sessionId: principal?.session_id ?? null,
      requestId: request.requestId?.slice(0, 128) ?? null,
      ipHash: this.hashIdentifier(requestTracker(request as unknown as Record<string, unknown>)),
      userAgent: userAgent ? userAgent.slice(0, 512) : null
    };
  }

  hashIdentifier(value: string): string {
    return createHmac("sha256", this.key).update(value.trim().toLowerCase()).digest("hex");
  }

  async record(event: AuditEvent, manager: EntityManager = this.dataSource.manager): Promise<void> {
    const repository = manager.getRepository(AdminAuditEventEntity);
    await repository.save(repository.create({
      action: event.action,
      outcome: event.outcome ?? "success",
      actor_admin_user_id: event.actorAdminUserId,
      session_id: event.sessionId,
      target_type: event.targetType ?? null,
      target_id: event.targetId ?? null,
      request_id: event.requestId,
      ip_hash: event.ipHash,
      user_agent: event.userAgent,
      metadata: event.metadata ?? {}
    }));
  }

  async recordBestEffort(event: AuditEvent): Promise<void> {
    try {
      await this.record(event);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event ${event.action}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
