export const TRIGGER_SETUP = `
-- Create the change_log table
CREATE TABLE IF NOT EXISTS __change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    row_id INTEGER,
    row_data TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create triggers for posts table
CREATE TRIGGER IF NOT EXISTS after_posts_insert
AFTER INSERT ON posts
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'posts',
        'INSERT',
        NEW.id,
        json_object('id', NEW.id, 'channel_id', NEW.channel_id, 'parent_id', NEW.parent_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_posts_update
AFTER UPDATE ON posts
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'posts',
        'UPDATE',
        NEW.id,
        json_object('id', NEW.id, 'channel_id', NEW.channel_id, 'parent_id', NEW.parent_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_posts_delete
AFTER DELETE ON posts
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'posts',
        'DELETE',
        OLD.id,
        json_object('id', OLD.id, 'channel_id', OLD.channel_id)
    );
END;

-- Create triggers for post_reactions table
CREATE TRIGGER IF NOT EXISTS after_post_reactions_insert
AFTER INSERT ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        'INSERT',
        json_object('contact_id', NEW.contact_id, 'post_id', NEW.post_id),
        json_object('contact_id', NEW.contact_id, 'post_id', NEW.post_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_post_reactions_update
AFTER UPDATE ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        'UPDATE',
        json_object('contact_id', NEW.contact_id, 'post_id', NEW.post_id),
        json_object('contact_id', NEW.contact_id, 'post_id', NEW.post_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_post_reactions_delete
AFTER DELETE ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        'DELETE',
        OLD.value,
        json_object('value', OLD.value, 'post_id', OLD.post_id)
    );
END;

-- Create triggers for thread_unreads table
CREATE TRIGGER IF NOT EXISTS after_thread_unreads_insert
AFTER INSERT ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        'INSERT',
        json_object('channel_id', NEW.channel_id, 'thread_id', NEW.thread_id),
        json_object('channel_id', NEW.channel_id, 'thread_id', NEW.thread_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_thread_unreads_update
AFTER UPDATE ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        'UPDATE',
        json_object('channel_id', NEW.channel_id, 'thread_id', NEW.thread_id),
        json_object('channel_id', NEW.channel_id, 'thread_id', NEW.thread_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_thread_unreads_delete
AFTER DELETE ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        'DELETE',
        json_object('channel_id', OLD.channel_id, 'thread_id', OLD.thread_id),
        json_object('channel_id', OLD.channel_id, 'thread_id', OLD.thread_id)
    );
END;

-- Create triggers for volume_settings table. Used to drive reactive updates
-- for thread-scoped volume changes that affect cached ['post', id] queries.
-- Gated on item_type='thread' so bulk setVolumes calls (which are dominated
-- by channel and group entries) don't fire hundreds of __change_log events
-- and block the main thread via processChanges callbacks. Channel/group
-- volume reactivity is handled through the existing table-deps invalidation
-- path for channel/group queries.
CREATE TRIGGER IF NOT EXISTS after_volume_settings_insert
AFTER INSERT ON volume_settings
WHEN NEW.item_type = 'thread'
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'volume_settings',
        'INSERT',
        NEW.item_id,
        json_object('item_id', NEW.item_id, 'item_type', NEW.item_type)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_volume_settings_update
AFTER UPDATE ON volume_settings
WHEN NEW.item_type = 'thread'
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'volume_settings',
        'UPDATE',
        NEW.item_id,
        json_object('item_id', NEW.item_id, 'item_type', NEW.item_type)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_volume_settings_delete
AFTER DELETE ON volume_settings
WHEN OLD.item_type = 'thread'
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'volume_settings',
        'DELETE',
        OLD.item_id,
        json_object('item_id', OLD.item_id, 'item_type', OLD.item_type)
    );
END;
`;
