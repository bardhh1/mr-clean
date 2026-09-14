import { Global, Module } from "@nestjs/common";
import { AdminCsrfGuard } from "./admin-csrf.guard";
import { AdminOriginGuard } from "./admin-origin.guard";
import { CsrfService } from "./csrf.service";

@Global()
@Module({
  providers: [CsrfService, AdminOriginGuard, AdminCsrfGuard],
  exports: [CsrfService, AdminOriginGuard, AdminCsrfGuard]
})
export class BrowserSecurityModule {}
