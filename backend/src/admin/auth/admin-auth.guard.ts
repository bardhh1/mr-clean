import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { accessCookieName } from "./auth.constants";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header("authorization");
    const bearer = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const token = bearer || cookies?.[accessCookieName];

    if (!token) throw new UnauthorizedException("Admin authentication is required");
    request.admin = await this.auth.verifyAccessToken(token);
    return true;
  }
}
