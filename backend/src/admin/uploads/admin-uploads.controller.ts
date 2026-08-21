import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { StorageService } from "../../storage/storage.service";
import type { UploadedImage } from "../../storage/storage.types";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { TrustedClientGuard } from "../auth/trusted-client.guard";
import { DeleteUploadDto } from "./dto/delete-upload.dto";

@ApiTags("admin uploads")
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, TrustedClientGuard)
@Controller("admin/uploads/product-images")
export class AdminUploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
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
    file: UploadedImage
  ) {
    return this.storage.uploadProductImage(file);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Delete one product image from Railway Bucket" })
  async remove(@Query() query: DeleteUploadDto): Promise<void> {
    await this.storage.deleteProductImage(query.key);
  }
}
