-- Add homebrew support to character_classes
ALTER TABLE character_classes ADD COLUMN is_homebrew boolean NOT NULL DEFAULT false;
ALTER TABLE character_classes ADD COLUMN homebrew_url text;
