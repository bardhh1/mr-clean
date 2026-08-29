import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from "vitest";
import type { AppEnvironment } from "../config/env.validation";
import { StorageService } from "./storage.service";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn()
}));

const configuration: Record<keyof AppEnvironment, AppEnvironment[keyof AppEnvironment]> = {
  NODE_ENV: "test",
  PORT: 3000,
  API_PREFIX: "api/v1",
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  DATABASE_SSL: false,
  DATABASE_POOL_MAX: 5,
  JWT_ACCESS_SECRET: "unused-in-storage-unit-test-secret",
  JWT_ACCESS_ISSUER: "mr-clean-api",
  JWT_ACCESS_AUDIENCE: "mr-clean-admin",
  JWT_ACCESS_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 30,
  REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 45,
  ADMIN_MAX_FAILED_LOGINS: 5,
  ADMIN_LOCKOUT_MINUTES: 15,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  AWS_ENDPOINT_URL: "https://storage.invalid",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key-value",
  AWS_S3_BUCKET_NAME: "test-product-images",
  AWS_DEFAULT_REGION: "auto",
  AWS_S3_URL_STYLE: "path"
};

function serviceUnderTest(): StorageService {
  const config = {
    get: vi.fn((key: keyof AppEnvironment) => configuration[key])
  } as unknown as ConfigService<AppEnvironment, true>;
  return new StorageService(config);
}

function uploadedImage(mimetype: string) {
  return {
    buffer: Buffer.from("image-body"),
    mimetype,
    originalname: "produkt test.png",
    size: 10
  };
}

describe("StorageService", () => {
  let send: MockInstance<S3Client["send"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    vi.mocked(getSignedUrl).mockImplementation(() =>
      Promise.resolve("https://signed.invalid/products/test.png")
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads an image with immutable metadata and returns a signed URL", async () => {
    const result = await serviceUnderTest().uploadProductImage(uploadedImage("image/png"));

    expect(result.key).toMatch(/^products\/[0-9a-f-]+\.png$/);
    expect(result).toMatchObject({
      url: "https://signed.invalid/products/test.png",
      expires_in: 900
    });
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: "test-product-images",
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable"
    });
  });

  it.each([
    ["image/webp", ".webp"],
    ["image/jpeg", ".jpg"]
  ])("uses the expected extension for %s", async (mimetype, extension) => {
    const result = await serviceUnderTest().uploadProductImage(uploadedImage(mimetype));
    expect(result.key.endsWith(extension)).toBe(true);
  });

  it("rejects unsafe delete keys before calling object storage", async () => {
    await expect(serviceUnderTest().deleteProductImage("../admin-secret"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it("deletes only product-scoped objects", async () => {
    await serviceUnderTest().deleteProductImage("products/retired.png");

    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    const command = send.mock.calls[0]?.[0] as DeleteObjectCommand;
    expect(command.input).toEqual({
      Bucket: "test-product-images",
      Key: "products/retired.png"
    });
  });

  it("combines public and private product image locations", async () => {
    const service = serviceUnderTest();
    const result = await service.resolveProductImages(
      ["https://cdn.invalid/public.png"],
      ["products/private.png"]
    );

    expect(result).toEqual([
      "https://cdn.invalid/public.png",
      "https://signed.invalid/products/test.png"
    ]);
    expect(getSignedUrl).toHaveBeenCalledOnce();
  });
});
