CREATE TABLE `liability_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`title` text NOT NULL DEFAULT '有还款能力拒不还款责任书',
	`content` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'pending',
	`signature_blob_key` text,
	`signed_at` integer,
	`created_at` integer NOT NULL
);
