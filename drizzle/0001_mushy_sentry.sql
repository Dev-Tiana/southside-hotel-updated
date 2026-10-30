CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`actorType` varchar(40) NOT NULL,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_holds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(48) NOT NULL,
	`roomCategoryId` int NOT NULL,
	`checkIn` date NOT NULL,
	`checkOut` date NOT NULL,
	`rooms` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`status` enum('active','expired','consumed','released') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_holds_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_holds_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `contact_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`enquiryType` varchar(80) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','in progress','resolved') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hotel_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(120) NOT NULL,
	`settingValue` text,
	`verification` enum('confirmed','awaiting approval') NOT NULL DEFAULT 'awaiting approval',
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hotel_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `hotel_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCategoryId` int NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetKey` varchar(255) NOT NULL,
	`sourceUrl` text NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`permissionStatus` enum('unresolved','requested','approved','rejected') NOT NULL DEFAULT 'unresolved',
	`ownershipNote` text,
	`altText` text,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_assets_assetKey_unique` UNIQUE(`assetKey`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`providerReference` varchar(180),
	`status` enum('initiated','pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_provider_reference` UNIQUE(`providerReference`)
);
--> statement-breakpoint
CREATE TABLE `reservation_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`fromStatus` varchar(40),
	`toStatus` varchar(40) NOT NULL,
	`actorType` varchar(40) NOT NULL,
	`actorId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reservation_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(24) NOT NULL,
	`guestId` int NOT NULL,
	`roomCategoryId` int NOT NULL,
	`checkIn` date NOT NULL,
	`checkOut` date NOT NULL,
	`adults` int NOT NULL,
	`children` int NOT NULL DEFAULT 0,
	`rooms` int NOT NULL DEFAULT 1,
	`nights` int NOT NULL,
	`status` enum('draft','pending payment','pending manual confirmation','confirmed','checked in','checked out','cancellation requested','cancelled','expired','payment failed') NOT NULL DEFAULT 'pending manual confirmation',
	`source` enum('website','staff','walk in','telephone','whatsapp') NOT NULL DEFAULT 'website',
	`subtotal` decimal(12,2) NOT NULL,
	`tax` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`amountPaid` decimal(12,2) NOT NULL DEFAULT '0',
	`outstanding` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`rateSnapshot` text NOT NULL,
	`termsSnapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservations_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `room_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`verification` enum('verified','provisional','awaiting approval') NOT NULL DEFAULT 'awaiting approval',
	`maxOccupancy` int,
	`bedConfiguration` text,
	`amenities` text,
	`sellableInventory` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `room_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `room_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCategoryId` int NOT NULL,
	`rateDate` date,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `booking_holds` ADD CONSTRAINT `booking_holds_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_blocks` ADD CONSTRAINT `inventory_blocks_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_status_history` ADD CONSTRAINT `reservation_status_history_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_guestId_guests_id_fk` FOREIGN KEY (`guestId`) REFERENCES `guests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_rates` ADD CONSTRAINT `room_rates_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `booking_holds_dates` ON `booking_holds` (`roomCategoryId`,`checkIn`,`checkOut`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_blocks_dates` ON `inventory_blocks` (`roomCategoryId`,`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `reservations_date_status` ON `reservations` (`checkIn`,`checkOut`,`status`);--> statement-breakpoint
CREATE INDEX `reservations_category_dates` ON `reservations` (`roomCategoryId`,`checkIn`,`checkOut`);--> statement-breakpoint
CREATE INDEX `room_rates_category_date` ON `room_rates` (`roomCategoryId`,`rateDate`);