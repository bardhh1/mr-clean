import { Global, Module } from "@nestjs/common";
import { AdminCsrfGuard } from "./admin-csrf.guard";
import { AdminOriginGuard } from "./admin-origin.guard";
import { CsrfService } from "./csrf.service";
import { TurnstileService } from "./turnstile.service";

@Global()
@Module({
  providers: [CsrfService, AdminOriginGuard, AdminCsrfGuard, TurnstileService],
  exports: [CsrfService, AdminOriginGuard, AdminCsrfGuard, TurnstileService]
})
export class BrowserSecurityModule {}
