CREATE TABLE `invoice_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_custom_fields_invoice_id_idx` ON `invoice_custom_fields` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "invoice_line_items_unit_price_check" CHECK("invoice_line_items"."unit_price_cents" >= 0),
	CONSTRAINT "invoice_line_items_amount_check" CHECK("invoice_line_items"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `invoice_line_items_invoice_id_idx` ON `invoice_line_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`payment_terms` text NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`business_email` text DEFAULT '' NOT NULL,
	`business_phone` text DEFAULT '' NOT NULL,
	`business_address` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`customer_address` text DEFAULT '' NOT NULL,
	`discount_cents` integer NOT NULL,
	`tax_rate` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "invoices_status_check" CHECK("invoices"."status" in ('draft', 'sent')),
	CONSTRAINT "invoices_discount_check" CHECK("invoices"."discount_cents" >= 0 and "invoices"."discount_cents" <= "invoices"."subtotal_cents"),
	CONSTRAINT "invoices_dates_check" CHECK("invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "invoices_tax_check" CHECK("invoices"."tax_cents" >= 0),
	CONSTRAINT "invoices_total_check" CHECK("invoices"."total_cents" = "invoices"."subtotal_cents" - "invoices"."discount_cents" + "invoices"."tax_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_issue_date_idx` ON `invoices` (`issue_date`);