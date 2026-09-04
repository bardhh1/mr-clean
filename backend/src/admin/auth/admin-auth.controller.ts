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
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminMfaService } from "./admin-mfa.service";
import { accessCookieName, refreshCookieName } from "./auth.constants";
import { CurrentAdmin } from "./current-admin.decorator";
import { LoginDto } from "./dto/login.dto";
import { MfaRecoveryCodesDto, MfaVerifyDto } from "./dto/mfa-verify.dto";
import { TrustedClientGuard } from "./trusted-client.guard";
import type { AdminPrincipal } from "./auth.types";

@ApiTags("admin auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly mfa: AdminMfaService,
    private readonly config: ConfigService<AppEnvironment, true>
  ) {}

  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Verify the owner password and begin mandatory MFA" })
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.verifyCredentials(input.email, input.password);
    this.clearSessionCookies(response);
    return this.mfa.begin(user);
  }

  @Post("mfa/verify")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Finish MFA enrollment or verify an existing MFA factor" })
  async verifyMfa(
    @Body() input: MfaVerifyDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.mfa.complete(input.challenge_token, input.code);
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
  @UseGuards(AdminAuthGuard, TrustedClientGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Replace recovery codes after a fresh TOTP verification" })
  regenerateRecoveryCodes(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() input: MfaRecoveryCodesDto
  ) {
    return this.mfa.regenerateRecoveryCodes(admin.id, admin.session_id, input.code);
  }

  @Post("refresh")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(TrustedClientGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Rotate the refresh session and access token" })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(this.readCookie(request, refreshCookieName) ?? "");
    this.setSessionCookies(response, result);
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(TrustedClientGuard)
  @ApiOperation({ summary: "Revoke the current refresh-session family" })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.readCookie(request, refreshCookieName));
    this.clearSessionCookies(response);
  }

  @Get("me")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: "Read the authenticated admin identity" })
  @ApiOkResponse({ description: "The active admin principal." })
  me(@CurrentAdmin() admin: AdminPrincipal | undefined) {
    return { user: admin, mfa_enabled: Boolean(admin) };
  }

  @Get("sessions")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdminAuthGuard, TrustedClientGuard)
  @ApiOperation({ summary: "List active sessions for the single administrator" })
  sessions(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.listSessions(admin.id, admin.session_id);
  }

  @Post("logout-all")
  @HttpCode(204)
  @UseGuards(AdminAuthGuard, TrustedClientGuard)
  @ApiOperation({ summary: "Revoke every active administrator session" })
  async logoutAll(
    @CurrentAdmin() admin: AdminPrincipal,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    await this.auth.logoutAll(admin.id);
    this.clearSessionCookies(response);
  }

  private setSessionCookies(
    response: Response,
    result: {
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
  }

  private refreshCookiePath(): string {
    const prefix = this.config.get("API_PREFIX", { infer: true }).replace(/^\/+|\/+$/g, "");
    return `/${prefix}/admin/auth`;
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      path,
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
  }
}
