CREATE TABLE `corporate_account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payee_name` text DEFAULT '' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`account_no` text DEFAULT '' NOT NULL,
	`qr_image_url` text DEFAULT '' NOT NULL
);
