CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`icon_image` text,
	`cover_image` text,
	`title` text,
	`description` text,
	`added_to_group_at` integer,
	`current_user_is_member` integer,
	`post_count` integer,
	`unread_count` integer,
	`first_unread_post_id` text,
	`last_post_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contact_group_pins` (
	`contact_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text,
	`bio` text,
	`status` text,
	`color` text,
	`avatarImage` text,
	`coverImage` text
);
--> statement-breakpoint
CREATE TABLE `group_member_roles` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `group_id`, `role_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`,`role_id`) REFERENCES `group_roles`(`group_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`joined_at` integer,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_nav_section_channels` (
	`group_nav_section_id` integer,
	`channel_id` integer,
	`index` integer,
	PRIMARY KEY(`channel_id`, `group_nav_section_id`),
	FOREIGN KEY (`group_nav_section_id`) REFERENCES `group_nav_sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_nav_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`icon_image` text,
	`cover_image` text,
	`title` text,
	`description` text,
	`index` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_roles` (
	`id` text,
	`group_id` text,
	`image` text,
	`title` text,
	`cover` text,
	`description` text,
	PRIMARY KEY(`group_id`, `id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`icon_image` text,
	`icon_image_color` text,
	`cover_image` text,
	`cover_image_color` text,
	`title` text,
	`description` text,
	`is_secret` integer,
	`last_post_at` integer
);
--> statement-breakpoint
CREATE TABLE `pins` (
	`type` text,
	`item_id` text
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` integer,
	`title` text,
	`image` text,
	`content` text,
	`sent_at` integer,
	`received_at` integer,
	`reply_count` integer,
	`type` text,
	`channel_id` integer,
	`group_id` text,
	`text` text,
	FOREIGN KEY (`author_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`contact_id` text NOT NULL,
	`post_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`contact_id`, `post_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread_unread_states` (
	`channel_id` integer,
	`thread_id` text,
	`count` integer,
	`first_unread_post_id` text,
	PRIMARY KEY(`channel_id`, `thread_id`),
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `unreads` (
	`channelId` text PRIMARY KEY NOT NULL,
	`type` text,
	`totalCount` integer,
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
