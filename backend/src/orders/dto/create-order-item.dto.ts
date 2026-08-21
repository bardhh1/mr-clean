import { IsInt, IsUUID, Max, Min } from "class-validator";

export class CreateOrderItemDto {
  @IsUUID()
  product_id!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}
