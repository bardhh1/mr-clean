import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { CategoryEntity } from "./category.entity";

@Entity({ name: "products" })
export class ProductEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "text", nullable: true })
  catalog_code!: string | null;

  @Index()
  @Column({ type: "uuid" })
  category_id!: string;

  @Column({ type: "text" })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "text" })
  slug!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "integer", default: 0 })
  price_cents!: number;

  @Column({ type: "char", length: 3, default: "EUR" })
  currency!: "EUR";

  @Column({ type: "text" })
  unit!: string;

  @Column({ type: "text", array: true, default: () => "'{}'::text[]" })
  image_urls!: string[];

  @Column({ type: "text", array: true, default: () => "'{}'::text[]" })
  image_keys!: string[];

  @Column({ type: "boolean", default: true })
  is_active!: boolean;

  @Column({ type: "boolean", default: false })
  is_featured!: boolean;

  @Column({ type: "boolean", default: false })
  requires_quote!: boolean;

  @Column({ type: "text", default: "Në stok" })
  stock_label!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @ManyToOne(() => CategoryEntity, (category) => category.products, {
    onDelete: "RESTRICT"
  })
  @JoinColumn({ name: "category_id" })
  category?: CategoryEntity;
}
