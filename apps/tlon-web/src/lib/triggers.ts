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
        NEW.id,
        json_object('id', NEW.id, 'post_id', NEW.post_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_post_reactions_update
AFTER UPDATE ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        'UPDATE',
        NEW.id,
        json_object('id', NEW.id, 'post_id', NEW.post_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_post_reactions_delete
AFTER DELETE ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        'DELETE',
        OLD.id,
        json_object('id', OLD.id, 'post_id', OLD.post_id)
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
        NEW.id,
        json_object('id', NEW.id, 'thread_id', NEW.thread_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_thread_unreads_update
AFTER UPDATE ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        'UPDATE',
        NEW.id,
        json_object('id', NEW.id, 'thread_id', NEW.thread_id)
    );
END;

CREATE TRIGGER IF NOT EXISTS after_thread_unreads_delete
AFTER DELETE ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        'DELETE',
        OLD.id,
        json_object('id', OLD.id, 'thread_id', OLD.thread_id)
    );
END;
`;
