import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailOutboxService } from "./email-outbox.service";
import { EmailOutboxWorker } from "./email-outbox.worker";
import { EmailOutboxEntity } from "./entities/email-outbox.entity";
import { ResendEmailTransport } from "./resend-email.transport";

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutboxEntity])],
  providers: [EmailOutboxService, EmailOutboxWorker, ResendEmailTransport],
  exports: [EmailOutboxService]
})
export class EmailModule {}
