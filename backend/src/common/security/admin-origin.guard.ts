import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AppEnvironment } from "../../config/env.validation";

@Injectable()
export class AdminOriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.allowedOrigins = new Set(
      config.get("CORS_ORIGINS", { infer: true }).split(",").map((value) => value.trim())
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;

    const origin = request.header("origin")?.trim();
    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException("Request origin is not allowed");
    }
    return true;
  }
}
