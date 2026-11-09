CREATE TABLE `chat_scripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'rule' NOT NULL,
	`rule_key` text DEFAULT '' NOT NULL,
	`pattern` text DEFAULT '' NOT NULL,
	`analysis` text DEFAULT '' NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
