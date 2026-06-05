CREATE TABLE `notes_notebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`flag_name` text NOT NULL,
	`notebook_id` integer NOT NULL,
	`title` text NOT NULL,
	`visibility` text,
	`root_folder_id` integer,
	`created_by` text,
	`created_at` integer,
	`updated_by` text,
	`updated_at` integer,
	`synced_at` integer,
	`last_opened_at` integer,
	`current_user_role` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_notebooks_host_flag_name_index` ON `notes_notebooks` (`host`,`flag_name`);--> statement-breakpoint
CREATE INDEX `notes_notebooks_updated_at_index` ON `notes_notebooks` (`updated_at`);--> statement-breakpoint
CREATE TABLE `notes_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`notebook_flag` text NOT NULL,
	`folder_id` integer NOT NULL,
	`notebook_id` integer NOT NULL,
	`name` text NOT NULL,
	`parent_folder_id` integer,
	`created_by` text,
	`created_at` integer,
	`updated_by` text,
	`updated_at` integer,
	`synced_at` integer,
	FOREIGN KEY (`notebook_flag`) REFERENCES `notes_notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_folders_notebook_flag_index` ON `notes_folders` (`notebook_flag`);--> statement-breakpoint
CREATE INDEX `notes_folders_notebook_parent_index` ON `notes_folders` (`notebook_flag`,`parent_folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `notes_folders_notebook_folder_id_index` ON `notes_folders` (`notebook_flag`,`folder_id`);--> statement-breakpoint
CREATE TABLE `notes_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`notebook_flag` text NOT NULL,
	`note_id` integer NOT NULL,
	`notebook_id` integer NOT NULL,
	`folder_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`body_md` text NOT NULL,
	`created_by` text,
	`created_at` integer,
	`updated_by` text,
	`updated_at` integer,
	`revision` integer NOT NULL,
	`synced_at` integer,
	FOREIGN KEY (`notebook_flag`) REFERENCES `notes_notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_notes_notebook_flag_index` ON `notes_notes` (`notebook_flag`);--> statement-breakpoint
CREATE INDEX `notes_notes_notebook_folder_index` ON `notes_notes` (`notebook_flag`,`folder_id`);--> statement-breakpoint
CREATE INDEX `notes_notes_notebook_updated_at_index` ON `notes_notes` (`notebook_flag`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notes_notes_notebook_note_id_index` ON `notes_notes` (`notebook_flag`,`note_id`);--> statement-breakpoint
CREATE TABLE `notes_members` (
	`notebook_flag` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text NOT NULL,
	`synced_at` integer,
	FOREIGN KEY (`notebook_flag`) REFERENCES `notes_notebooks`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY(`notebook_flag`, `contact_id`)
);
--> statement-breakpoint
CREATE INDEX `notes_members_contact_id_index` ON `notes_members` (`contact_id`);
