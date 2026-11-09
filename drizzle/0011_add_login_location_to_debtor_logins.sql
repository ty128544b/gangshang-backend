ALTER TABLE `debtor_logins` ADD COLUMN `country` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `debtor_logins` ADD COLUMN `province` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `debtor_logins` ADD COLUMN `city` text DEFAULT '' NOT NULL;
