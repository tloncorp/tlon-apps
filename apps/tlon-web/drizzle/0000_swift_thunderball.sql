CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text,
	`bio` text,
	`status` text,
	`color` text,
	`avatarImage` text,
	`coverImage` text,
	`pinnedGroupIds` text
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`flag` text PRIMARY KEY NOT NULL,
	`fleet` text,
	`cabals` text,
	`channels` text,
	`cordon` text,
	`meta` text,
	`zones` text,
	`zoneOrder` text,
	`bloc` text,
	`secret` integer,
	`saga` text,
	`flaggedContent` text
);
--> statement-breakpoint
CREATE TABLE `unreads` (
	`channelId` text,
	`type` text,
	`totalCount` integer
);
