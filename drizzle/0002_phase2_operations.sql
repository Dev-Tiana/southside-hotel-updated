CREATE TABLE `housekeeping_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`status` enum('open','in progress','completed','inspected') NOT NULL DEFAULT 'open',
	`assignedTo` int,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `housekeeping_tasks_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `inventory_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCategoryId` int NOT NULL,
	`capacitySource` enum('category','physical') NOT NULL DEFAULT 'category',
	`reconciledCapacity` int NOT NULL,
	`cancellationReconciledAt` timestamp NOT NULL,
	`reconciledBy` int NOT NULL,
	`reason` text NOT NULL,
	CONSTRAINT `inventory_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_policies_roomCategoryId_unique` UNIQUE(`roomCategoryId`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `physical_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCategoryId` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`housekeepingStatus` enum('dirty','clean','inspected') NOT NULL DEFAULT 'dirty',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `physical_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `physical_rooms_label_unique` UNIQUE(`label`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `reservation_amendments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`actorId` int NOT NULL,
	`reason` text NOT NULL,
	`beforeSnapshot` longtext NOT NULL,
	`afterSnapshot` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reservation_amendments_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `room_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`roomId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_assignments_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `room_maintenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`inventoryBlockId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_maintenance_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_maintenance_inventoryBlockId_unique` UNIQUE(`inventoryBlockId`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `inventory_blocks` ADD `releasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_roomId_physical_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `physical_rooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_assignedTo_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_policies` ADD CONSTRAINT `inventory_policies_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_policies` ADD CONSTRAINT `inventory_policies_reconciledBy_users_id_fk` FOREIGN KEY (`reconciledBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `physical_rooms` ADD CONSTRAINT `physical_rooms_roomCategoryId_room_categories_id_fk` FOREIGN KEY (`roomCategoryId`) REFERENCES `room_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_amendments` ADD CONSTRAINT `reservation_amendments_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_amendments` ADD CONSTRAINT `reservation_amendments_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_assignments` ADD CONSTRAINT `room_assignments_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_assignments` ADD CONSTRAINT `room_assignments_roomId_physical_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `physical_rooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_assignments` ADD CONSTRAINT `room_assignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_maintenance` ADD CONSTRAINT `room_maintenance_roomId_physical_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `physical_rooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_maintenance` ADD CONSTRAINT `room_maintenance_inventoryBlockId_inventory_blocks_id_fk` FOREIGN KEY (`inventoryBlockId`) REFERENCES `inventory_blocks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `housekeeping_tasks_room` ON `housekeeping_tasks` (`roomId`,`status`);--> statement-breakpoint
CREATE INDEX `physical_rooms_category` ON `physical_rooms` (`roomCategoryId`);--> statement-breakpoint
CREATE INDEX `room_assignments_room` ON `room_assignments` (`roomId`,`releasedAt`);--> statement-breakpoint
CREATE INDEX `room_assignments_reservation` ON `room_assignments` (`reservationId`);