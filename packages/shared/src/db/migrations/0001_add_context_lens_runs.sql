CREATE TABLE `context_lens_runs` (
	`bot_ship` text NOT NULL,
	`lens_id` text NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`received_at` integer NOT NULL,
	`payload` text,
	PRIMARY KEY(`bot_ship`, `lens_id`)
);
--> statement-breakpoint
CREATE INDEX `context_lens_runs_received_at_index` ON `context_lens_runs` (`received_at`);