-- Run this once on your MySQL database to support soft-deleting devotees/members
ALTER TABLE devotee ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT true;
