import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { csrfCookieName, refreshCookieName } from "../../admin/auth/auth.constants";
import { CsrfService } from "./csrf.service";

@Injectable()
export class AdminCsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;

    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[csrfCookieName];
    const headerToken = request.header("x-csrf-token")?.trim();
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("CSRF validation failed");
    }

    const sessionId = request.admin?.session_id ?? this.csrf.sessionIdFromRefreshToken(
      cookies?.[refreshCookieName] ?? ""
    );
    this.csrf.assertValid(headerToken, sessionId);
    return true;
  }
}
