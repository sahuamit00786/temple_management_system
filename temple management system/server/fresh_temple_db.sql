-- Fresh / clean database for a new temple deployment.
-- Structure identical to gsgkarat_temple_db; ALL transactional data removed.
-- Kept: roles, menu, role permissions, lookup types + structural lookups
--       (hall events, payment modes, stars, membership), default settings,
--       one Super Admin (SBT).
-- After import: log in, change the admin password, set temple name/logo/QR in Settings,
--       add archanai / donation / ubayam items in Lookups.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET NAMES utf8mb4 */;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------- structure

CREATE TABLE `role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `Role_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `roleId` int NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `otpCode` varchar(191) DEFAULT NULL,
  `otpExpiresAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  KEY `User_roleId_fkey` (`roleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `menuitem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(191) NOT NULL,
  `label` varchar(191) NOT NULL,
  `icon` varchar(191) DEFAULT NULL,
  `path` varchar(191) DEFAULT NULL,
  `parentId` int DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `MenuItem_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rolepermission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roleId` int NOT NULL,
  `menuItemId` int NOT NULL,
  `canView` tinyint(1) NOT NULL DEFAULT '0',
  `canCreate` tinyint(1) NOT NULL DEFAULT '0',
  `canEdit` tinyint(1) NOT NULL DEFAULT '0',
  `canDelete` tinyint(1) NOT NULL DEFAULT '0',
  `canExport` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `RolePermission_roleId_menuItemId_key` (`roleId`,`menuItemId`),
  KEY `RolePermission_menuItemId_fkey` (`menuItemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `userpermission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `menuItemId` int NOT NULL,
  `canView` tinyint(1) NOT NULL DEFAULT '0',
  `canCreate` tinyint(1) NOT NULL DEFAULT '0',
  `canEdit` tinyint(1) NOT NULL DEFAULT '0',
  `canDelete` tinyint(1) NOT NULL DEFAULT '0',
  `canExport` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_userpermission_user_menu` (`userId`,`menuItemId`),
  KEY `fk_userpermission_menuitem` (`menuItemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `auditlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `action` varchar(191) NOT NULL,
  `entity` varchar(191) NOT NULL,
  `entityId` varchar(191) DEFAULT NULL,
  `before` json DEFAULT NULL,
  `after` json DEFAULT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_userId_fkey` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `setting` (
  `key` varchar(191) NOT NULL,
  `value` json NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lookuptype` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `isPosMenu` tinyint(1) NOT NULL DEFAULT '0',
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `LookupType_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lookupvalue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `typeId` int NOT NULL,
  `parentId` int DEFAULT NULL,
  `nameEn` varchar(191) NOT NULL,
  `nameTa` varchar(191) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `depositPct` int DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `LookupValue_typeId_fkey` (`typeId`),
  KEY `LookupValue_parentId_fkey` (`parentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `devotee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `altPhone` varchar(191) DEFAULT NULL,
  `icNumber` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `addressTa` varchar(255) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `memberType` varchar(20) DEFAULT NULL,
  `membershipTypeId` int DEFAULT NULL,
  `membershipTypeLabel` varchar(100) DEFAULT NULL,
  `membershipPrice` decimal(10,2) DEFAULT NULL,
  `membershipMonths` int DEFAULT NULL,
  `membershipStartDate` date DEFAULT NULL,
  `membershipEndDate` date DEFAULT NULL,
  `membershipPaidVia` varchar(100) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `Devotee_phone_idx` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `devoteemembership` (
  `id` int NOT NULL AUTO_INCREMENT,
  `devoteeId` int NOT NULL,
  `membershipTypeId` int DEFAULT NULL,
  `membershipTypeLabel` varchar(255) DEFAULT NULL,
  `membershipPrice` decimal(10,2) DEFAULT NULL,
  `membershipMonths` int DEFAULT NULL,
  `membershipUnit` varchar(255) DEFAULT NULL,
  `membershipStartDate` date DEFAULT NULL,
  `membershipEndDate` date DEFAULT NULL,
  `membershipPaidVia` varchar(255) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `devoteeId` (`devoteeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `devoteenote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `devoteeId` int NOT NULL,
  `body` text NOT NULL,
  `createdById` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `DevoteeNote_devoteeId_idx` (`devoteeId`),
  KEY `DevoteeNote_createdById_fkey` (`createdById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hallbooking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientUuid` varchar(191) NOT NULL,
  `bookingNo` varchar(191) NOT NULL,
  `devoteeId` int NOT NULL,
  `eventTypeId` int NOT NULL,
  `eventDate` datetime(3) NOT NULL,
  `startTime` datetime(3) NOT NULL,
  `endTime` datetime(3) NOT NULL,
  `hallRate` decimal(10,2) NOT NULL,
  `depositDue` decimal(10,2) NOT NULL,
  `depositPaidAt` datetime(3) DEFAULT NULL,
  `balanceDueAt` datetime(3) NOT NULL,
  `balancePaidAt` datetime(3) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'PENDING_DEPOSIT',
  `notes` text,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `HallBooking_clientUuid_key` (`clientUuid`),
  UNIQUE KEY `HallBooking_bookingNo_key` (`bookingNo`),
  KEY `HallBooking_eventDate_idx` (`eventDate`),
  KEY `HallBooking_devoteeId_fkey` (`devoteeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bookingnote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `note` text NOT NULL,
  `createdById` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `BookingNote_bookingId_fkey` (`bookingId`),
  KEY `BookingNote_createdById_fkey` (`createdById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bookingcancelnote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `note` text NOT NULL,
  `cancelledById` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `BookingCancelNote_bookingId_key` (`bookingId`),
  KEY `BookingCancelNote_cancelledById_fkey` (`cancelledById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reminder` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `channel` varchar(191) NOT NULL DEFAULT 'WHATSAPP',
  `scheduledAt` datetime(3) NOT NULL,
  `sentAt` datetime(3) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'SCHEDULED',
  PRIMARY KEY (`id`),
  KEY `Reminder_bookingId_fkey` (`bookingId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transaction` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientUuid` varchar(191) NOT NULL,
  `receiptNo` varchar(191) NOT NULL,
  `localChitNo` varchar(191) DEFAULT NULL,
  `kind` varchar(191) NOT NULL,
  `devoteeId` int DEFAULT NULL,
  `devoteeName` varchar(191) DEFAULT NULL,
  `starNatchathiram` varchar(191) DEFAULT NULL,
  `total` decimal(10,2) NOT NULL,
  `paymentMode` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'PAID',
  `bookingId` int DEFAULT NULL,
  `createdById` int NOT NULL,
  `deviceId` varchar(191) DEFAULT NULL,
  `txDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `syncedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Transaction_clientUuid_key` (`clientUuid`),
  UNIQUE KEY `Transaction_receiptNo_key` (`receiptNo`),
  KEY `Transaction_txDate_idx` (`txDate`),
  KEY `Transaction_kind_idx` (`kind`),
  KEY `Transaction_devoteeId_fkey` (`devoteeId`),
  KEY `Transaction_bookingId_fkey` (`bookingId`),
  KEY `Transaction_createdById_fkey` (`createdById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transactionitem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transactionId` int NOT NULL,
  `lookupValueId` int NOT NULL,
  `nameSnapshot` varchar(191) NOT NULL,
  `nameTa` varchar(255) DEFAULT NULL,
  `priceSnapshot` decimal(10,2) NOT NULL,
  `qty` int NOT NULL DEFAULT '1',
  `lineTotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `TransactionItem_transactionId_fkey` (`transactionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int UNSIGNED NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- seed data

INSERT INTO `role` (`id`, `name`, `description`, `isSystem`) VALUES
(1, 'Staff', 'Counter billing', 1),
(2, 'Superadmin', 'Full access to everything', 1),
(3, 'Manager', 'Operations, reports and lookups', 1);

INSERT INTO `menuitem` (`id`, `key`, `label`, `icon`, `path`, `parentId`, `sortOrder`) VALUES
(1, 'dashboard', 'Dashboard', 'LayoutDashboard', '/', NULL, 1),
(2, 'pos', 'Counter (POS)', 'ReceiptText', '/pos', NULL, 2),
(3, 'bookings', 'Hall Booking', 'CalendarDays', '/bookings', NULL, 3),
(4, 'devotees', 'Organization members', 'Users', '/devotees', NULL, 4),
(5, 'reports', 'Reports', 'BarChart3', '/reports', NULL, 5),
(6, 'lookups', 'Lookups', 'ListTree', '/lookups', NULL, 6),
(7, 'users', 'User Management', 'ShieldCheck', '/users', NULL, 7),
(8, 'settings', 'Settings', 'Settings', '/settings', NULL, 8),
(9, 'temple-config', 'Temple Config', 'Settings2', '/temple-config', NULL, 6),
(12, 'payments', 'Payments', 'CreditCard', '/payments', NULL, 45);

INSERT INTO `rolepermission` (`id`, `roleId`, `menuItemId`, `canView`, `canCreate`, `canEdit`, `canDelete`, `canExport`) VALUES
(1, 2, 1, 1, 1, 1, 1, 1),
(2, 2, 2, 1, 1, 1, 1, 1),
(3, 2, 3, 1, 1, 1, 1, 1),
(4, 2, 4, 1, 1, 1, 1, 1),
(5, 2, 5, 1, 1, 1, 1, 1),
(6, 2, 6, 1, 1, 1, 1, 1),
(7, 2, 7, 1, 1, 1, 1, 1),
(8, 2, 8, 1, 1, 1, 1, 1),
(19, 2, 9, 1, 1, 1, 1, 1),
(31, 2, 12, 1, 1, 1, 1, 1),
(9, 3, 1, 0, 0, 0, 0, 0),
(10, 3, 2, 1, 1, 1, 1, 1),
(11, 3, 3, 0, 0, 0, 0, 0),
(12, 3, 4, 0, 0, 0, 0, 0),
(13, 3, 5, 0, 0, 0, 0, 0),
(14, 3, 6, 1, 1, 1, 0, 1),
(20, 3, 9, 0, 0, 0, 0, 0),
(38, 3, 7, 0, 0, 0, 0, 0),
(39, 3, 8, 0, 0, 0, 0, 0),
(40, 3, 12, 0, 0, 0, 0, 0),
(15, 1, 1, 1, 1, 1, 1, 1),
(16, 1, 2, 1, 1, 1, 1, 1),
(17, 1, 4, 0, 0, 0, 0, 0),
(18, 1, 9, 0, 0, 0, 0, 0),
(27, 1, 3, 0, 0, 0, 0, 0),
(28, 1, 5, 0, 0, 0, 0, 0),
(29, 1, 7, 0, 0, 0, 0, 0),
(30, 1, 8, 0, 0, 0, 0, 0),
(67, 1, 12, 0, 0, 0, 0, 0);

-- Only account: Super Admin (login: SBT / SASBT@2026). Change the password after first login.
INSERT INTO `user` (`id`, `name`, `email`, `phone`, `passwordHash`, `roleId`, `isActive`, `lastLoginAt`, `createdAt`, `otpCode`, `otpExpiresAt`) VALUES
(1, 'Super Admin', 'SBT', NULL, '$2a$12$jKsKuFzIoOr8ENYkHFg8T.NRpzlUJI/cZGvAIxXj1hnMdsYm4ahNS', 2, 1, NULL, NOW(3), NULL, NULL);

INSERT INTO `lookuptype` (`id`, `code`, `name`, `isPosMenu`, `sortOrder`, `isActive`) VALUES
(1, 'ARCHANAI', 'Archanai & Poojai', 1, 0, 1),
(2, 'DONATION', 'Donation Categories', 1, 2, 1),
(3, 'HALL_EVENT', 'Hall & Event Types', 0, 0, 1),
(4, 'ANNADHANAM', 'Abhishagem Ubhayam', 1, 3, 1),
(5, 'PAYMENT_MODE', 'Payment Modes', 0, 0, 1),
(6, 'NATCHATHIRAM', 'Natchathiram (Stars)', 0, 0, 1),
(9, 'BOOKING_PAYMENT_MODE', 'Booking Payment Modes', 0, 0, 1),
(12, 'MEMBERSHIP_TYPE', 'Membership Types', 0, 10, 1),
(13, 'UBAYAM', 'Ubayam', 1, 1, 1),
(14, 'MAHA_KUMBABISHEGAM_3_0', 'Maha Kumbabishegam 3.0', 1, 4, 1),
(15, 'MADHANDRA_POOJAI', 'Madhandra Poojai', 1, 5, 1);

-- Structural lookups only (hall events, payment modes, stars, membership).
-- Archanai & Poojai items 1-13 seeded (ids 54-66); donation / ubayam / abhishegam are NOT seeded: add via Lookups.
INSERT INTO `lookupvalue` (`id`, `typeId`, `parentId`, `nameEn`, `nameTa`, `price`, `depositPct`, `meta`, `isActive`, `sortOrder`) VALUES
(11, 3, NULL, 'Hall Wedding', NULL, 8000.00, 50, NULL, 1, 1),
(12, 3, NULL, 'Temple Wedding', NULL, 7000.00, 50, NULL, 1, 2),
(13, 3, NULL, 'Hall Engagement', NULL, 6000.00, 50, NULL, 1, 3),
(14, 3, NULL, 'Temple Engagement', NULL, 5000.00, 50, NULL, 1, 4),
(15, 3, NULL, 'Archanai Wedding', NULL, 1000.00, 50, NULL, 1, 5),
(19, 5, NULL, 'Cash', NULL, NULL, NULL, '{"code": "CASH"}', 1, 1),
(20, 5, NULL, 'DuitNow QR', NULL, NULL, NULL, '{"code": "DUITNOW_QR"}', 1, 2),
(21, 6, NULL, 'Aswini', NULL, NULL, NULL, NULL, 1, 1),
(22, 6, NULL, 'Bharani', NULL, NULL, NULL, NULL, 1, 2),
(23, 6, NULL, 'Karthigai', NULL, NULL, NULL, NULL, 1, 3),
(24, 6, NULL, 'Rohini', NULL, NULL, NULL, NULL, 1, 4),
(25, 6, NULL, 'Mirugasirisham', NULL, NULL, NULL, NULL, 1, 5),
(26, 6, NULL, 'Thiruvathirai', NULL, NULL, NULL, NULL, 1, 6),
(27, 6, NULL, 'Punarpoosam', NULL, NULL, NULL, NULL, 1, 7),
(28, 6, NULL, 'Poosam', NULL, NULL, NULL, NULL, 1, 8),
(29, 6, NULL, 'Ayilyam', NULL, NULL, NULL, NULL, 1, 9),
(30, 6, NULL, 'Magam', NULL, NULL, NULL, NULL, 1, 10),
(31, 6, NULL, 'Pooram', NULL, NULL, NULL, NULL, 1, 11),
(32, 6, NULL, 'Uthiram', NULL, NULL, NULL, NULL, 1, 12),
(33, 6, NULL, 'Hastham', NULL, NULL, NULL, NULL, 1, 13),
(34, 6, NULL, 'Chithirai', NULL, NULL, NULL, NULL, 1, 14),
(35, 6, NULL, 'Swathi', NULL, NULL, NULL, NULL, 1, 15),
(36, 6, NULL, 'Visakam', NULL, NULL, NULL, NULL, 1, 16),
(37, 6, NULL, 'Anusham', NULL, NULL, NULL, NULL, 1, 17),
(38, 6, NULL, 'Kettai', NULL, NULL, NULL, NULL, 1, 18),
(39, 6, NULL, 'Moolam', NULL, NULL, NULL, NULL, 1, 19),
(40, 6, NULL, 'Pooradam', NULL, NULL, NULL, NULL, 1, 20),
(41, 6, NULL, 'Uthiradam', NULL, NULL, NULL, NULL, 1, 21),
(42, 6, NULL, 'Thiruvonam', NULL, NULL, NULL, NULL, 1, 22),
(43, 6, NULL, 'Avittam', NULL, NULL, NULL, NULL, 1, 23),
(44, 6, NULL, 'Sathayam', NULL, NULL, NULL, NULL, 1, 24),
(45, 6, NULL, 'Poorattathi', NULL, NULL, NULL, NULL, 1, 25),
(46, 6, NULL, 'Uthirattathi', NULL, NULL, NULL, NULL, 1, 26),
(47, 6, NULL, 'Revathi', NULL, NULL, NULL, NULL, 1, 27),
(49, 9, NULL, 'Cash', NULL, NULL, NULL, '{"code": "CASH"}', 1, 1),
(50, 9, NULL, 'Online Transfer', NULL, NULL, NULL, '{"code": "ONLINE_TRANSFER"}', 1, 2),
(51, 9, NULL, 'Cheque', NULL, NULL, NULL, '{"code": "CHEQUE"}', 1, 3),
(52, 9, NULL, 'DuitNow QR', NULL, NULL, NULL, '{"code": "DUITNOW_QR"}', 1, 4),
(53, 12, NULL, 'Annual', NULL, 15.00, NULL, '{"unit": "month", "quantity": 12}', 1, 1),
(54, 1, NULL, 'Coconut Archanai', NULL, 5.00, NULL, NULL, 1, 1),
(55, 1, NULL, 'Fruit Archanai', NULL, 3.00, NULL, NULL, 1, 2),
(56, 1, NULL, 'Navakiraga Archanai', NULL, 2.00, NULL, NULL, 1, 3),
(57, 1, NULL, 'Motorbike Archanai', NULL, 15.00, NULL, NULL, 1, 4),
(58, 1, NULL, 'Car Archanai', NULL, 30.00, NULL, NULL, 1, 5),
(59, 1, NULL, 'Mangalya Archanai', NULL, 21.00, NULL, NULL, 1, 6),
(60, 1, NULL, 'Ghee Lamp (old rate)', NULL, 1.00, NULL, NULL, 0, 7),
(61, 1, NULL, 'Ghee Lamp', NULL, 2.00, NULL, NULL, 1, 8),
(62, 1, NULL, 'Neem Oil', NULL, 4.00, NULL, NULL, 1, 9),
(63, 1, NULL, 'Ellu Catti', NULL, 4.00, NULL, NULL, 1, 10),
(64, 1, NULL, 'Motca Deepam', NULL, 5.00, NULL, NULL, 1, 11),
(65, 1, NULL, 'Milk', NULL, 6.00, NULL, NULL, 1, 12),
(66, 1, NULL, 'Coconut Break', NULL, 3.00, NULL, NULL, 1, 13);

-- Generic defaults: set the real temple name / logo / QR in Settings after import.
-- numbering prefix "SBT" is a guess -- change if needed.
INSERT INTO `setting` (`key`, `value`) VALUES
('message.templates', '[{"id": "3bfa9256-bb5e-4e29-8412-b8eacb9f6e5b", "body": "Hii {{name}},\\n\\nYour second half payment for booking no {{bookingNo}} is pending. So please try to complete on time total outstanding is {{outstanding}} and the hall rate is {{hallRate}} and the event date is {{eventDate}} and event purpose is {{eventType}}.\\n\\nThank you", "name": "Leftover Payment Reminder"}, {"id": "43f71be9-8481-4191-9616-2f32ea74b978", "body": "Hii {{name}} ,\\nThank you for taking our membership plan {{membershipPlan}} worth {{membershipFee}} your start date is {{membershipStart}} and ending on {{membershipEnd}} and you paid via {{membershipPaidVia}}.", "name": "Membership message"}]'),
('numbering.bookingDigits', '6'),
('numbering.bookingPrefix', '"SBT"'),
('numbering.receiptDigits', '4'),
('numbering.receiptPrefix', '"SBT"'),
('qr.imageUrl', '""'),
('receipt.footerText', '"Thank you for your devotion"'),
('receipt.language', '"EN"'),
('receipt.paperWidth', '"80"'),
('reminder.leadDays', '7'),
('temple.address', '""'),
('temple.logoUrl', '""'),
('temple.name', '"Temple Name"'),
('temple.nameTa', '""'),
('temple.phone', '""');

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('0700c6ae-17e4-4808-b82b-5d6e7342fc90', '4177b2a4da4a4206b0dcd64ce824022ebd99a8f477ee5669eac23380e220c21b', '2026-06-12 15:33:35.144', '20260612153333_init', NULL, NULL, '2026-06-12 15:33:33.571', 1),
('07c9a2ba-f793-43cd-aa29-25d010d69c8b', '181c35973a07fb65777c1005e64a7e002537324a52f6c07bfc3acc0e160058c5', '2026-06-13 19:32:43.126', '20260613193242_add_devotee_notes', NULL, NULL, '2026-06-13 19:32:42.760', 1);

-- Next auto-increment values (keep seeded ids from colliding)
ALTER TABLE `lookuptype`    AUTO_INCREMENT = 17;
ALTER TABLE `lookupvalue`   AUTO_INCREMENT = 91;
ALTER TABLE `menuitem`      AUTO_INCREMENT = 13;
ALTER TABLE `role`          AUTO_INCREMENT = 4;
ALTER TABLE `rolepermission` AUTO_INCREMENT = 77;
ALTER TABLE `user`          AUTO_INCREMENT = 2;

-- ------------------------------------------------------------- constraints

ALTER TABLE `auditlog`
  ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bookingcancelnote`
  ADD CONSTRAINT `BookingCancelNote_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `hallbooking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingCancelNote_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bookingnote`
  ADD CONSTRAINT `BookingNote_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `hallbooking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `devoteemembership`
  ADD CONSTRAINT `devoteemembership_ibfk_1` FOREIGN KEY (`devoteeId`) REFERENCES `devotee` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `devoteenote`
  ADD CONSTRAINT `DevoteeNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `DevoteeNote_devoteeId_fkey` FOREIGN KEY (`devoteeId`) REFERENCES `devotee` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hallbooking`
  ADD CONSTRAINT `HallBooking_devoteeId_fkey` FOREIGN KEY (`devoteeId`) REFERENCES `devotee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lookupvalue`
  ADD CONSTRAINT `LookupValue_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `lookupvalue` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LookupValue_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `lookuptype` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reminder`
  ADD CONSTRAINT `Reminder_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `hallbooking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `rolepermission`
  ADD CONSTRAINT `RolePermission_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menuitem` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `transaction`
  ADD CONSTRAINT `Transaction_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `hallbooking` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Transaction_devoteeId_fkey` FOREIGN KEY (`devoteeId`) REFERENCES `devotee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `transactionitem`
  ADD CONSTRAINT `TransactionItem_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `transaction` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user`
  ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `userpermission`
  ADD CONSTRAINT `fk_userpermission_menuitem` FOREIGN KEY (`menuItemId`) REFERENCES `menuitem` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_userpermission_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
