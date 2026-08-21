import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import { ProductEntity } from "../../catalog/entities/product.entity";
import { OrderEntity } from "./order.entity";

const bigintNumber = {
  to: (value: number) => value,
  from: (value: string) => Number(value)
};

@Entity({ name: "order_items" })
export class OrderItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  order_id!: string;

  @Column({ type: "uuid", nullable: true })
  product_id!: string | null;

  @Column({ type: "smallint" })
  sort_order!: number;

  @Column({ type: "text" })
  name_snapshot!: string;

  @Column({ type: "text" })
  unit_snapshot!: string;

  @Column({ type: "integer" })
  quantity!: number;

  @Column({ type: "integer" })
  unit_price_cents!: number;

  @Column({ type: "bigint", transformer: bigintNumber })
  line_total_cents!: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order?: OrderEntity;

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "product_id" })
  product?: ProductEntity | null;
}
