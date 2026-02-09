ALTER TABLE `posts` ADD `is_bot` integer DEFAULT false;--> statement-breakpoint
UPDATE `posts` SET `is_bot` = 1 WHERE `author_id` LIKE '~pinser-botter-%';
