import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateOrderDto } from "./create-order.dto";

const validInput = {
  idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customer_name: "Arta Hoxha",
  phone: "+383 44 123 456",
  city: "Prishtinë",
  address: "Rruga e Testit 10",
  payment_preference: "cash",
  items: [{
    product_id: "21111111-1111-4111-8111-222222222222",
    quantity: 2
  }]
};

describe("CreateOrderDto", () => {
  it("accepts and trims a valid checkout payload", async () => {
    const input = plainToInstance(CreateOrderDto, {
      ...validInput,
      customer_name: "  Arta Hoxha  "
    });

    expect(await validate(input)).toHaveLength(0);
    expect(input.customer_name).toBe("Arta Hoxha");
  });

  it("rejects whitespace identities and duplicate product lines", async () => {
    const input = plainToInstance(CreateOrderDto, {
      ...validInput,
      customer_name: "   ",
      items: [validInput.items[0], validInput.items[0]]
    });

    const errors = await validate(input);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["customer_name", "items"])
    );
  });
});
