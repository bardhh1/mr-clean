import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminCsrfGuard } from "../../common/security/admin-csrf.guard";
import { AdminOriginGuard } from "../../common/security/admin-origin.guard";
import { CsrfService } from "../../common/security/csrf.service";
import { AuditService } from "../../audit/audit.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaService } from "./admin-mfa.service";
import { accessCookieName, csrfCookieName, refreshCookieName } from "./auth.constants";
import { CurrentAdmin } from "./current-admin.decorator";
import { LoginDto } from "./dto/login.dto";
import { MfaBootstrapDto, MfaRecoveryCodesDto, MfaVerifyDto } from "./dto/mfa-verify.dto";
import { TrustedClientGuard } from "./trusted-client.guard";
import type { AdminPrincipal } from "./auth.types";

@ApiTags("admin auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly mfa: AdminMfaService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly csrf: CsrfService,
    private readonly audit: AuditService
  ) {}

  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminOriginGuard, TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Verify the owner password and begin mandatory MFA" })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const user = await this.auth.verifyCredentials(
      input.email,
      input.password,
      this.audit.context(request)
    );
    this.clearSessionCookies(response);
    return this.mfa.begin(user);
  }

  @Post("mfa/bootstrap")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminOriginGuard, TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Authorize first-time MFA enrollment with an operator token" })
  bootstrapMfa(@Body() input: MfaBootstrapDto, @Req() request: Request) {
    return this.mfa.bootstrap(
      input.challenge_token,
      input.bootstrap_token,
      this.audit.context(request)
    );
  }

  @Post("mfa/verify")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminOriginGuard, TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Finish MFA enrollment or verify an existing MFA factor" })
  async verifyMfa(
    @Body() input: MfaVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.mfa.complete(
      input.challenge_token,
      input.code,
      this.audit.context(request)
    );
    this.setSessionCookies(response, result.session);
    return {
      user: result.session.user,
      recovery_codes: result.recoveryCodes,
      used_recovery_code: result.usedRecoveryCode
    };
  }

  @Post("mfa/recovery-codes")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Replace recovery codes after a fresh TOTP verification" })
  regenerateRecoveryCodes(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() input: MfaRecoveryCodesDto,
    @Req() request: Request
  ) {
    return this.mfa.regenerateRecoveryCodes(
      admin.id,
      admin.session_id,
      input.code,
      this.audit.context(request, admin)
    );
  }

  @Post("refresh")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminOriginGuard, TrustedClientGuard, AdminCsrfGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Rotate the refresh session and access token" })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(
      this.readCookie(request, refreshCookieName) ?? "",
      this.audit.context(request)
    );
    this.setSessionCookies(response, result);
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AdminOriginGuard, TrustedClientGuard, AdminCsrfGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Revoke the current refresh-session family" })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(
      this.readCookie(request, refreshCookieName),
      this.audit.context(request)
    );
    this.clearSessionCookies(response);
  }

  @Get("me")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Read the authenticated admin identity" })
  @ApiOkResponse({ description: "The active admin principal." })
  me(@CurrentAdmin() admin: AdminPrincipal | undefined) {
    return { user: admin, mfa_enabled: Boolean(admin) };
  }

  @Get("sessions")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminAuthGuard, TrustedClientGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "List active sessions for the single administrator" })
  sessions(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.listSessions(admin.id, admin.session_id);
  }

  @Post("logout-all")
  @HttpCode(204)
  @UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Revoke every active administrator session" })
  async logoutAll(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    await this.auth.logoutAll(admin.id, this.audit.context(request, admin));
    this.clearSessionCookies(response);
  }

  private setSessionCookies(
    response: Response,
    result: {
      sessionId: string;
      accessToken: string;
      refreshToken: string;
      accessTokenMaxAgeMs: number;
      refreshTokenMaxAgeMs: number;
    }
  ): void {
    response.cookie(accessCookieName, result.accessToken, {
      ...this.cookieOptions("/"),
      maxAge: result.accessTokenMaxAgeMs
    });
    response.cookie(refreshCookieName, result.refreshToken, {
      ...this.cookieOptions(this.refreshCookiePath()),
      maxAge: result.refreshTokenMaxAgeMs
    });
    response.cookie(csrfCookieName, this.csrf.issue(
      result.sessionId,
      result.refreshTokenMaxAgeMs
    ), {
      ...this.cookieOptions("/"),
      httpOnly: false,
      maxAge: result.refreshTokenMaxAgeMs
    });
  }

  private refreshCookiePath(): string {
    const prefix = this.config.get("API_PREFIX", { infer: true }).replace(/^\/+|\/+$/g, "");
    return `/${prefix}/admin/auth`;
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      path,
      priority: "high",
      sameSite: this.config.get("AUTH_COOKIE_SAME_SITE", { infer: true }),
      secure: this.config.get("AUTH_COOKIE_SECURE", { infer: true })
    };
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[name];
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(accessCookieName, this.cookieOptions("/"));
    response.clearCookie(refreshCookieName, this.cookieOptions(this.refreshCookiePath()));
    response.clearCookie(csrfCookieName, {
      ...this.cookieOptions("/"),
      httpOnly: false
    });
  }
}
