CREATE TABLE `activity_events` (
	`id` text NOT NULL,
	`bucket_id` text NOT NULL,
	`source_id` text NOT NULL,
	`type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`post_id` text,
	`author_id` text,
	`parent_id` text,
	`parent_author_id` text,
	`channel_id` text,
	`group_id` text,
	`is_mention` integer,
	`should_notify` integer,
	`content` text,
	PRIMARY KEY(`bucket_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `channel_writers` (
	`channel_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`channel_id`, `role_id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`group_id` text,
	`icon_image` text,
	`icon_image_color` text,
	`cover_image` text,
	`cover_image_color` text,
	`title` text,
	`description` text,
	`added_to_group_at` integer,
	`current_user_is_member` integer,
	`post_count` integer,
	`unread_count` integer,
	`first_unread_post_id` text,
	`last_post_id` text,
	`last_post_at` integer,
	`is_cached_pending_channel` integer,
	`is_dm_invite` integer,
	`is_muted` integer DEFAULT false,
	`is_noisy` integer DEFAULT false,
	`synced_at` integer,
	`remote_updated_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_member_roles` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `group_id`, `role_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`membership_type` text NOT NULL,
	`chat_id` text,
	`contact_id` text NOT NULL,
	`joined_at` integer,
	`status` text,
	PRIMARY KEY(`chat_id`, `contact_id`)
);
--> statement-breakpoint
CREATE TABLE `contact_group_pins` (
	`contact_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
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
	`coverImage` text,
	`blocked` integer
);
--> statement-breakpoint
CREATE TABLE `group_flagged_posts` (
	`group_id` text NOT NULL,
	`post_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`flagged_by_contact_id` text NOT NULL,
	`flagged_at` integer,
	PRIMARY KEY(`group_id`, `post_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_member_bans` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`banned_at` integer,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_member_invites` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`invited_at` integer,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_nav_section_channels` (
	`group_nav_section_id` text,
	`channel_id` text,
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
	`icon_image_color` text,
	`cover_image` text,
	`cover_image_color` text,
	`title` text,
	`description` text,
	`index` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_rank_bans` (
	`group_id` text NOT NULL,
	`rank_id` text NOT NULL,
	`banned_at` integer,
	PRIMARY KEY(`group_id`, `rank_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group_roles` (
	`id` text,
	`group_id` text,
	`icon_image` text,
	`icon_image_color` text,
	`cover_image` text,
	`cover_image_color` text,
	`title` text,
	`description` text,
	PRIMARY KEY(`group_id`, `id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
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
	`privacy` text,
	`have_invite` integer,
	`have_requested_invite` integer,
	`current_user_is_member` integer NOT NULL,
	`is_new` integer,
	`join_status` text,
	`last_post_id` text,
	`last_post_at` integer,
	`is_muted` integer DEFAULT false,
	`is_noisy` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `pins` (
	`type` text NOT NULL,
	`index` integer NOT NULL,
	`item_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post_images` (
	`post_id` text,
	`src` text,
	`alt` text,
	`width` integer,
	`height` integer,
	PRIMARY KEY(`post_id`, `src`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post_reactions` (
	`contact_id` text NOT NULL,
	`post_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`contact_id`, `post_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post_windows` (
	`channel_id` text NOT NULL,
	`oldest_post_id` text NOT NULL,
	`newest_post_id` text NOT NULL,
	PRIMARY KEY(`channel_id`, `newest_post_id`, `oldest_post_id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`group_id` text,
	`parent_id` text,
	`type` text NOT NULL,
	`title` text,
	`image` text,
	`content` text,
	`received_at` integer NOT NULL,
	`sent_at` integer NOT NULL,
	`reply_count` integer,
	`reply_time` integer,
	`reply_contact_ids` text,
	`text_content` text,
	`has_app_reference` integer,
	`has_channel_reference` integer,
	`has_group_reference` integer,
	`has_link` integer,
	`has_image` integer,
	`hidden` integer DEFAULT false,
	`is_edited` integer,
	`delivery_status` text,
	`is_muted` integer DEFAULT false,
	`is_noisy` integer DEFAULT false,
	`backend_time` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text,
	`disable_app_tile_unreads` integer,
	`disable_avatars` integer,
	`disable_remote_content` integer,
	`disable_spellcheck` integer,
	`disable_nicknames` integer,
	`ordered_group_pins` text,
	`side_bar_sort` text,
	`group_side_bar_sort` text,
	`show_activity_message` integer,
	`log_activity` integer,
	`analytics_id` text,
	`seen_welcome_card` integer,
	`new_group_flags` text,
	`groups_nav_state` text,
	`messages_nav_state` text,
	`messages_filter` text,
	`gallery_settings` text,
	`notebook_settings` text
);
--> statement-breakpoint
CREATE TABLE `thread_unreads` (
	`channel_id` text,
	`thread_id` text,
	`notify` integer,
	`count` integer,
	`updated_at` integer NOT NULL,
	`first_unread_post_id` text,
	`first_unread_post_received_at` integer,
	PRIMARY KEY(`channel_id`, `thread_id`)
);
--> statement-breakpoint
CREATE TABLE `unreads` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`notify` integer NOT NULL,
	`count` integer NOT NULL,
	`count_without_threads` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`first_unread_post_id` text,
	`first_unread_post_received_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_sent_at_unique` ON `posts` (`sent_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `cache_id` ON `posts` (`author_id`,`sent_at`);