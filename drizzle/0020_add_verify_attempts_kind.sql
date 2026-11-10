ALTER TABLE `verify_attempts` ADD COLUMN `kind` text DEFAULT 'verify' NOT NULL;
DELETE FROM `verify_attempts`;
