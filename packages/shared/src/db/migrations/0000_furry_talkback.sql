CREATE TABLE `activity_event_contact_group_pins` (
	`activity_event_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`activity_event_id`, `group_id`),
	FOREIGN KEY (`activity_event_id`) REFERENCES `activity_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_event_contact_groups_activity_event_id_index` ON `activity_event_contact_group_pins` (`activity_event_id`);--> statement-breakpoint
CREATE INDEX `activity_event_contact_groups_group_id_index` ON `activity_event_contact_group_pins` (`group_id`);--> statement-breakpoint
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
	`group_event_user_id` text,
	`contact_user_id` text,
	`contact_update_type` text,
	`contact_update_value` text,
	PRIMARY KEY(`id`, `bucket_id`)
);
--> statement-breakpoint
CREATE TABLE `attestations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`value` text,
	`initiated_at` integer,
	`discoverability` text NOT NULL,
	`status` text NOT NULL,
	`status_message` text,
	`contact_id` text NOT NULL,
	`provider__url` text,
	`proving_tweet_id` text,
	`signature` text
);
--> statement-breakpoint
CREATE INDEX `attestations_contact_id_index` ON `attestations` (`contact_id`);--> statement-breakpoint
CREATE TABLE `base_unreads` (
	`id` text PRIMARY KEY DEFAULT 'base_unreads' NOT NULL,
	`notify` integer,
	`count` integer,
	`notify_count` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channel_readers` (
	`channel_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`channel_id`, `role_id`)
);
--> statement-breakpoint
CREATE INDEX `channel_readers_channel_id_index` ON `channel_readers` (`channel_id`);--> statement-breakpoint
CREATE INDEX `channel_readers_role_id_index` ON `channel_readers` (`role_id`);--> statement-breakpoint
CREATE TABLE `channel_unreads` (
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
CREATE INDEX `channel_unreads_channel_id_index` ON `channel_unreads` (`channel_id`);--> statement-breakpoint
CREATE TABLE `channel_writers` (
	`channel_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`channel_id`, `role_id`)
);
--> statement-breakpoint
CREATE INDEX `channel_writers_channel_id_index` ON `channel_writers` (`channel_id`);--> statement-breakpoint
CREATE INDEX `channel_writers_role_id_index` ON `channel_writers` (`role_id`);--> statement-breakpoint
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
	`contact_id` text,
	`added_to_group_at` integer,
	`current_user_is_member` integer,
	`current_user_is_host` integer,
	`post_count` integer,
	`unread_count` integer,
	`first_unread_post_id` text,
	`last_post_id` text,
	`last_post_at` integer,
	`last_post_sequence_num` integer,
	`is_cached_pending_channel` integer,
	`is_new_matched_contact` integer,
	`is_dm_invite` integer DEFAULT false,
	`synced_at` integer,
	`remote_updated_at` integer,
	`last_viewed_at` integer,
	`content_configuration` text,
	`posts_order` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `last_post_id` ON `channels` (`last_post_id`);--> statement-breakpoint
CREATE INDEX `last_post_at` ON `channels` (`last_post_at`);--> statement-breakpoint
CREATE INDEX `channels_group_id_index` ON `channels` (`group_id`);--> statement-breakpoint
CREATE INDEX `channels_contact_id_index` ON `channels` (`contact_id`);--> statement-breakpoint
CREATE TABLE `chat_member_roles` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `contact_id`, `role_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_member_roles_group_id_index` ON `chat_member_roles` (`group_id`);--> statement-breakpoint
CREATE INDEX `chat_member_roles_contact_id_index` ON `chat_member_roles` (`contact_id`);--> statement-breakpoint
CREATE INDEX `chat_member_roles_role_id_index` ON `chat_member_roles` (`role_id`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`membership_type` text NOT NULL,
	`chat_id` text,
	`contact_id` text NOT NULL,
	`joined_at` integer,
	`status` text,
	PRIMARY KEY(`chat_id`, `contact_id`)
);
--> statement-breakpoint
CREATE INDEX `group_members_chat_id_index` ON `group_members` (`chat_id`);--> statement-breakpoint
CREATE INDEX `group_members_contact_id_index` ON `group_members` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contact_attestations` (
	`contact_id` text NOT NULL,
	`attestation_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `attestation_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attestation_id`) REFERENCES `attestations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_attestations_contact_id_index` ON `contact_attestations` (`contact_id`);--> statement-breakpoint
CREATE INDEX `contact_attestations_attestation_id_index` ON `contact_attestations` (`attestation_id`);--> statement-breakpoint
CREATE TABLE `contact_group_pins` (
	`contact_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`contact_id`, `group_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_group_pins_contact_id_index` ON `contact_group_pins` (`contact_id`);--> statement-breakpoint
CREATE INDEX `contact_group_pins_group_id_index` ON `contact_group_pins` (`group_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`peerNickname` text,
	`customNickname` text,
	`nickname` text GENERATED ALWAYS AS (COALESCE("customNickname", "peerNickname")) STORED,
	`peerAvatarImage` text,
	`customAvatarImage` text,
	`avatarImage` text GENERATED ALWAYS AS (COALESCE("customAvatarImage", "peerAvatarImage")) STORED,
	`bio` text,
	`status` text,
	`color` text,
	`coverImage` text,
	`blocked` integer,
	`isContact` integer,
	`isContactSuggestion` integer,
	`systemContactId` text
);
--> statement-breakpoint
CREATE INDEX `contacts_system_contact_id_index` ON `contacts` (`systemContactId`);--> statement-breakpoint
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
CREATE INDEX `group_flagged_posts_group_id_index` ON `group_flagged_posts` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_flagged_posts_post_id_index` ON `group_flagged_posts` (`post_id`);--> statement-breakpoint
CREATE INDEX `group_flagged_posts_channel_id_index` ON `group_flagged_posts` (`channel_id`);--> statement-breakpoint
CREATE INDEX `group_flagged_posts_flagged_by_contact_id_index` ON `group_flagged_posts` (`flagged_by_contact_id`);--> statement-breakpoint
CREATE TABLE `group_join_requests` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`requested_at` integer,
	PRIMARY KEY(`group_id`, `contact_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_join_requests_group_id_index` ON `group_join_requests` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_join_requests_contact_id_index` ON `group_join_requests` (`contact_id`);--> statement-breakpoint
CREATE TABLE `group_member_bans` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`banned_at` integer,
	PRIMARY KEY(`group_id`, `contact_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_member_bans_group_id_index` ON `group_member_bans` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_member_bans_contact_id_index` ON `group_member_bans` (`contact_id`);--> statement-breakpoint
CREATE TABLE `group_member_invites` (
	`group_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`invited_at` integer,
	PRIMARY KEY(`group_id`, `contact_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_member_invites_group_id_index` ON `group_member_invites` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_member_invites_contact_id_index` ON `group_member_invites` (`contact_id`);--> statement-breakpoint
CREATE TABLE `group_nav_section_channels` (
	`group_nav_section_id` text,
	`channel_id` text,
	`channel_index` integer,
	PRIMARY KEY(`group_nav_section_id`, `channel_id`),
	FOREIGN KEY (`group_nav_section_id`) REFERENCES `group_nav_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_nav_section_channels_group_nav_section_id_index` ON `group_nav_section_channels` (`group_nav_section_id`);--> statement-breakpoint
CREATE INDEX `group_nav_section_channels_channel_id_index` ON `group_nav_section_channels` (`channel_id`);--> statement-breakpoint
CREATE TABLE `group_nav_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`group_id` text,
	`icon_image` text,
	`icon_image_color` text,
	`cover_image` text,
	`cover_image_color` text,
	`title` text,
	`description` text,
	`section_index` integer,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_nav_sections_group_id_index` ON `group_nav_sections` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_rank_bans` (
	`group_id` text NOT NULL,
	`rank_id` text NOT NULL,
	`banned_at` integer,
	PRIMARY KEY(`group_id`, `rank_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_rank_bans_group_id_index` ON `group_rank_bans` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_roles` (
	`id` text NOT NULL,
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
CREATE INDEX `group_roles_group_id_index` ON `group_roles` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_unreads` (
	`group_id` text PRIMARY KEY NOT NULL,
	`notify` integer,
	`count` integer,
	`notify_count` integer,
	`updated_at` integer NOT NULL
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
	`current_user_is_host` integer NOT NULL,
	`host_user_id` text NOT NULL,
	`is_new` integer,
	`is_personal_group` integer DEFAULT false,
	`join_status` text,
	`last_post_id` text,
	`last_post_at` integer,
	`synced_at` integer,
	`pending_members_dismissed_at` integer
);
--> statement-breakpoint
CREATE TABLE `pins` (
	`type` text NOT NULL,
	`pin_index` integer NOT NULL,
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
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_images_post_id_index` ON `post_images` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_reactions` (
	`contact_id` text NOT NULL,
	`post_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`contact_id`, `post_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_reactions_contact_id_index` ON `post_reactions` (`contact_id`);--> statement-breakpoint
CREATE INDEX `post_reactions_post_id_index` ON `post_reactions` (`post_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`group_id` text,
	`parent_id` text,
	`type` text NOT NULL,
	`title` text,
	`image` text,
	`description` text,
	`cover` text,
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
	`is_deleted` integer,
	`is_sequence_stub` integer DEFAULT false,
	`deleted_at` integer,
	`delivery_status` text,
	`edit_status` text,
	`delete_status` text,
	`last_edit_content` text,
	`last_edit_title` text,
	`last_edit_image` text,
	`sequence_number` integer,
	`synced_at` integer,
	`backend_time` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cache_id` ON `posts` (`channel_id`,`author_id`,`sent_at`,`sequence_number`);--> statement-breakpoint
CREATE INDEX `posts_channel_id` ON `posts` (`channel_id`,`id`);--> statement-breakpoint
CREATE INDEX `posts_group_id` ON `posts` (`group_id`,`id`);--> statement-breakpoint
CREATE INDEX `posts_author_id_index` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_parent_id_index` ON `posts` (`parent_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'settings' NOT NULL,
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
	`enable_telemetry` integer,
	`analytics_id` text,
	`seen_welcome_card` integer,
	`new_group_flags` text,
	`groups_nav_state` text,
	`messages_nav_state` text,
	`messages_filter` text,
	`gallery_settings` text,
	`notebook_settings` text,
	`activity_seen_timestamp` integer,
	`completed_wayfinding_splash` integer,
	`completed_wayfinding_tutorial` integer,
	`disable_tlon_infra_enhancement` integer
);
--> statement-breakpoint
CREATE TABLE `system_contact_sent_invites` (
	`invited_to` text,
	`system_contact_id` text,
	`invited_at` integer,
	PRIMARY KEY(`invited_to`, `system_contact_id`)
);
--> statement-breakpoint
CREATE INDEX `system_contact_sent_invites_system_contact_id_index` ON `system_contact_sent_invites` (`system_contact_id`);--> statement-breakpoint
CREATE TABLE `system_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone_number` text,
	`email` text,
	`contact_id` text
);
--> statement-breakpoint
CREATE INDEX `system_contacts_contact_id_index` ON `system_contacts` (`contact_id`);--> statement-breakpoint
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
CREATE TABLE `volume_settings` (
	`item_id` text PRIMARY KEY NOT NULL,
	`item_type` text NOT NULL,
	`level` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `volume_settings_item_id_index` ON `volume_settings` (`item_id`);