import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { AppEnvironment } from "../config/env.validation";
import type { UploadedImage } from "./storage.types";

const signedUrlLifetimeSeconds = 15 * 60;

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.bucket = config.get("AWS_S3_BUCKET_NAME", { infer: true });
    this.client = new S3Client({
      endpoint: config.get("AWS_ENDPOINT_URL", { infer: true }),
      region: config.get("AWS_DEFAULT_REGION", { infer: true }),
      forcePathStyle: config.get("AWS_S3_URL_STYLE", { infer: true }) === "path",
      credentials: {
        accessKeyId: config.get("AWS_ACCESS_KEY_ID", { infer: true }),
        secretAccessKey: config.get("AWS_SECRET_ACCESS_KEY", { infer: true })
      }
    });
  }

  async uploadProductImage(file: UploadedImage) {
    const extension = this.extensionFor(file.mimetype);
    const key = `products/${randomUUID()}.${extension}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        originalName: Buffer.from(file.originalname, "utf8").toString("base64url")
      }
    }));

    return {
      key,
      url: await this.signedUrl(key),
      expires_in: signedUrlLifetimeSeconds
    };
  }

  async deleteProductImage(key: string): Promise<void> {
    if (!key.startsWith("products/") || key.includes("..")) {
      throw new BadRequestException("Invalid product image key");
    }

    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
  }

  signedUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: signedUrlLifetimeSeconds }
    );
  }

  async resolveProductImages(imageUrls: string[], imageKeys: string[]): Promise<string[]> {
    const signed = await Promise.all(imageKeys.map((key) => this.signedUrl(key)));
    return [...imageUrls, ...signed];
  }

  private extensionFor(mimeType: string): "png" | "jpg" | "webp" {
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/webp") return "webp";
    return "jpg";
  }
}
