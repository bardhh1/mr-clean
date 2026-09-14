import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuditContext, AuditService } from "../../audit/audit.service";
import type { StorageService } from "../../storage/storage.service";
import type { UploadedImage } from "../../storage/storage.types";
import { AdminUploadsController } from "./admin-uploads.controller";

const context: AuditContext = {
  actorAdminUserId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  requestId: "request-1",
  ipHash: "a".repeat(64),
  userAgent: "vitest"
};

const request = {} as Request;
const file: UploadedImage = {
  buffer: Buffer.from("image"),
  mimetype: "image/webp",
  originalname: "product.webp",
  size: 5
};

function fixture() {
  const uploadProductImage = vi.fn().mockResolvedValue({
    key: "products/33333333-3333-4333-8333-333333333333.webp",
    url: "https://storage.invalid/signed",
    expires_in: 900
  });
  const deleteProductImage = vi.fn().mockResolvedValue(undefined);
  const record = vi.fn().mockResolvedValue(undefined);
  const recordBestEffort = vi.fn().mockResolvedValue(undefined);
  const storage = { uploadProductImage, deleteProductImage } as unknown as StorageService;
  const audit = {
    context: vi.fn().mockReturnValue(context),
    record,
    recordBestEffort
  } as unknown as AuditService;

  return {
    controller: new AdminUploadsController(storage, audit),
    uploadProductImage,
    deleteProductImage,
    record,
    recordBestEffort
  };
}

describe("AdminUploadsController audit ordering", () => {
  it("persists upload intent before storage and records completion afterward", async () => {
    const test = fixture();

    await expect(test.controller.upload(file, request)).resolves.toMatchObject({
      key: "products/33333333-3333-4333-8333-333333333333.webp"
    });

    expect(test.record.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.upload_requested",
      targetType: "product_image_operation"
    });
    expect(test.recordBestEffort.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.uploaded",
      targetType: "product_image",
      targetId: "products/33333333-3333-4333-8333-333333333333.webp"
    });
    expect(test.record.mock.invocationCallOrder[0])
      .toBeLessThan(test.uploadProductImage.mock.invocationCallOrder[0]);
    expect(test.uploadProductImage.mock.invocationCallOrder[0])
      .toBeLessThan(test.recordBestEffort.mock.invocationCallOrder[0]);
  });

  it("does not upload when the mandatory request event cannot be persisted", async () => {
    const test = fixture();
    test.record.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(test.controller.upload(file, request)).rejects.toThrow("audit unavailable");

    expect(test.uploadProductImage).not.toHaveBeenCalled();
    expect(test.recordBestEffort).not.toHaveBeenCalled();
  });

  it("persists delete intent before storage and records completion afterward", async () => {
    const test = fixture();
    const key = "products/33333333-3333-4333-8333-333333333333.webp";

    await expect(test.controller.remove({ key }, request)).resolves.toBeUndefined();

    expect(test.record.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.delete_requested",
      targetType: "product_image",
      targetId: key
    });
    expect(test.recordBestEffort.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.deleted",
      targetType: "product_image",
      targetId: key
    });
    expect(test.record.mock.invocationCallOrder[0])
      .toBeLessThan(test.deleteProductImage.mock.invocationCallOrder[0]);
    expect(test.deleteProductImage.mock.invocationCallOrder[0])
      .toBeLessThan(test.recordBestEffort.mock.invocationCallOrder[0]);
  });

  it("does not delete when the mandatory request event cannot be persisted", async () => {
    const test = fixture();
    test.record.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(test.controller.remove({ key: "products/product.webp" }, request))
      .rejects.toThrow("audit unavailable");

    expect(test.deleteProductImage).not.toHaveBeenCalled();
    expect(test.recordBestEffort).not.toHaveBeenCalled();
  });

  it("records a failed completion event and preserves the storage error", async () => {
    const test = fixture();
    test.uploadProductImage.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(test.controller.upload(file, request)).rejects.toThrow("storage unavailable");

    expect(test.recordBestEffort.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.upload_failed",
      outcome: "failure",
      targetType: "product_image_operation"
    });
  });

  it("records a failed delete event and preserves the storage error", async () => {
    const test = fixture();
    const key = "products/product.webp";
    test.deleteProductImage.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(test.controller.remove({ key }, request)).rejects.toThrow("storage unavailable");

    expect(test.recordBestEffort.mock.calls[0][0]).toMatchObject({
      action: "catalog.product_image.delete_failed",
      outcome: "failure",
      targetType: "product_image",
      targetId: key
    });
  });
});
