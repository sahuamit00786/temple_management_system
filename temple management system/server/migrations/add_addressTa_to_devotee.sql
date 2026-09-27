-- Run this once on your MySQL database to add Tamil address support
ALTER TABLE devotee ADD COLUMN addressTa VARCHAR(255) NULL AFTER address;
