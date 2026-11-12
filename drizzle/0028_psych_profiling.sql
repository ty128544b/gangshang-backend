ALTER TABLE learned_scripts ADD COLUMN stage TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE learned_scripts ADD COLUMN archetype TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE learned_scripts ADD COLUMN tone TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE cases ADD COLUMN education TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE cases ADD COLUMN occupation TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE cases ADD COLUMN background_note TEXT NOT NULL DEFAULT '';
---> statement-breakpoint
ALTER TABLE cases ADD COLUMN entry_point TEXT NOT NULL DEFAULT '';
