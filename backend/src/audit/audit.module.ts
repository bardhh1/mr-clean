import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditService } from "./audit.service";
import { AdminAuditEventEntity } from "./entities/admin-audit-event.entity";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditEventEntity])],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
