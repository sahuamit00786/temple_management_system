-- CreateTable
-- NOTE: table name is lowercase to match server/db.js's Sequelize `tableName: 'bookingcancelnote'`
-- exactly, since this project runs against MySQL instances with case-sensitive table names.
CREATE TABLE `bookingcancelnote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `note` TEXT NOT NULL,
    `cancelledById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BookingCancelNote_bookingId_key`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookingcancelnote` ADD CONSTRAINT `BookingCancelNote_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `hallbooking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingcancelnote` ADD CONSTRAINT `BookingCancelNote_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
