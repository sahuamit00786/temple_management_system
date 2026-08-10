-- AlterTable
ALTER TABLE `hallbooking` MODIFY `notes` TEXT NULL;

-- CreateTable
CREATE TABLE `DevoteeNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `devoteeId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DevoteeNote_devoteeId_idx`(`devoteeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DevoteeNote` ADD CONSTRAINT `DevoteeNote_devoteeId_fkey` FOREIGN KEY (`devoteeId`) REFERENCES `Devotee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevoteeNote` ADD CONSTRAINT `DevoteeNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
