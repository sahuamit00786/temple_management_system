-- Hall & event types move out of lookupvalue into their own table (ids preserved,
-- so existing hallbooking.eventTypeId values stay valid).

CREATE TABLE IF NOT EXISTS `eventtype` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameTa` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NULL,
    `depositPct` INTEGER NULL DEFAULT 50,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Copy existing HALL_EVENT values (only if eventtype is still empty)
INSERT INTO `eventtype` (`id`, `nameEn`, `nameTa`, `price`, `depositPct`, `isActive`, `sortOrder`)
SELECT v.`id`, v.`nameEn`, v.`nameTa`, v.`price`, COALESCE(v.`depositPct`, 50), v.`isActive`, v.`sortOrder`
FROM `lookupvalue` v
JOIN `lookuptype` t ON t.`id` = v.`typeId`
WHERE t.`code` = 'HALL_EVENT'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `id` FROM `eventtype`) e);

-- Remove the old lookup entries
DELETE v FROM `lookupvalue` v JOIN `lookuptype` t ON t.`id` = v.`typeId` WHERE t.`code` = 'HALL_EVENT';
DELETE FROM `lookuptype` WHERE `code` = 'HALL_EVENT';
