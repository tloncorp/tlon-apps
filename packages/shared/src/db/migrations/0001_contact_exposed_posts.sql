CREATE TABLE IF NOT EXISTS `contact_exposed_posts` (
	`contact_id` text NOT NULL,
	`reference_path` text NOT NULL,
	`post_id` text,
	PRIMARY KEY(`contact_id`, `reference_path`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contact_exposed_posts_contact_id_index` ON `contact_exposed_posts` (`contact_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contact_exposed_posts_post_id_index` ON `contact_exposed_posts` (`post_id`);
