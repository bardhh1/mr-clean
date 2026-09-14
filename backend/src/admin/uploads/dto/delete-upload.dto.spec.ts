import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { DeleteUploadDto } from "./delete-upload.dto";

describe("DeleteUploadDto", () => {
  it("rejects product-image keys one character beyond the audit target limit", async () => {
    const key = `products/${"a".repeat(120)}`;
    const input = plainToInstance(DeleteUploadDto, { key });

    expect(key).toHaveLength(129);
    expect((await validate(input)).map((error) => error.property)).toContain("key");
  });

  it("accepts product-image keys at the audit target limit", async () => {
    const key = `products/${"a".repeat(119)}`;
    const input = plainToInstance(DeleteUploadDto, { key });

    expect(key).toHaveLength(128);
    expect(await validate(input)).toHaveLength(0);
  });

  it("accepts an ordinary product-image key", async () => {
    const input = plainToInstance(DeleteUploadDto, {
      key: "products/01234567-89ab-cdef-0123-456789abcdef.webp"
    });

    expect(await validate(input)).toHaveLength(0);
  });
});
