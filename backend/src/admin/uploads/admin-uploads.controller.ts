import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import type { Request } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { AdminCsrfGuard } from "../../common/security/admin-csrf.guard";
import { AdminOriginGuard } from "../../common/security/admin-origin.guard";
import { StorageService } from "../../storage/storage.service";
import type { UploadedImage } from "../../storage/storage.types";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { TrustedClientGuard } from "../auth/trusted-client.guard";
import { DeleteUploadDto } from "./dto/delete-upload.dto";
import { AuditService } from "../../audit/audit.service";

@ApiTags("admin uploads")
@ApiBearerAuth()
@UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
@Controller("admin/uploads/product-images")
export class AdminUploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly audit: AuditService
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }
  }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" }
      }
    }
  })
  @ApiOperation({ summary: "Upload a validated product image to Railway Bucket" })
  upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(png|jpeg|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
    )
    file: UploadedImage,
    @Req() request: Request
  ) {
    return this.uploadAndAudit(file, request);
  }

  @Delete()
  @Throttle({ default: { limit: 20, ttl: 5 * 60_000 } })
  @HttpCode(204)
  @ApiOperation({ summary: "Delete one product image from Railway Bucket" })
  async remove(@Query() query: DeleteUploadDto, @Req() request: Request): Promise<void> {
    const operationId = randomUUID();
    const context = this.audit.context(request);

    await this.audit.record({
      ...context,
      action: "catalog.product_image.delete_requested",
      targetType: "product_image",
      targetId: query.key,
      metadata: { operation_id: operationId }
    });

    try {
      await this.storage.deleteProductImage(query.key);
    } catch (error) {
      await this.audit.recordBestEffort({
        ...context,
        action: "catalog.product_image.delete_failed",
        outcome: "failure",
        targetType: "product_image",
        targetId: query.key,
        metadata: { operation_id: operationId }
      });
      throw error;
    }

    await this.audit.recordBestEffort({
      ...context,
      action: "catalog.product_image.deleted",
      targetType: "product_image",
      targetId: query.key,
      metadata: { operation_id: operationId }
    });
  }

  private async uploadAndAudit(file: UploadedImage, request: Request) {
    const operationId = randomUUID();
    const context = this.audit.context(request);
    const metadata = {
      operation_id: operationId,
      content_type: file.mimetype,
      size_bytes: file.size
    };

    await this.audit.record({
      ...context,
      action: "catalog.product_image.upload_requested",
      targetType: "product_image_operation",
      targetId: operationId,
      metadata
    });

    let result: Awaited<ReturnType<StorageService["uploadProductImage"]>>;
    try {
      result = await this.storage.uploadProductImage(file);
    } catch (error) {
      await this.audit.recordBestEffort({
        ...context,
        action: "catalog.product_image.upload_failed",
        outcome: "failure",
        targetType: "product_image_operation",
        targetId: operationId,
        metadata
      });
      throw error;
    }

    await this.audit.recordBestEffort({
      ...context,
      action: "catalog.product_image.uploaded",
      targetType: "product_image",
      targetId: result.key,
      metadata
    });
    return result;
  }
}
