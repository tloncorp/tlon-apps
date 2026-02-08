-- Migration: Update existing posts from bot authors to have type 'bot'
UPDATE posts
SET type = 'bot'
WHERE author_id LIKE '~pinser-botter-%'
  AND type IN ('chat', 'note', 'block');
