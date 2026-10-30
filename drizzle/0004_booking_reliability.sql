CREATE TABLE `booking_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`audience` enum('guest','administrator') NOT NULL,
	`state` enum('disabled','pending','sending','sent','failed') NOT NULL DEFAULT 'disabled',
	`attempts` int NOT NULL DEFAULT 0,
	`lastErrorCode` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `booking_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_notifications_event_unique` UNIQUE(`reservationId`,`audience`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `booking_submissions` (
	`keyHash` varchar(64) NOT NULL,
	`requestHash` varchar(64) NOT NULL,
	`reservationId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_submissions_keyHash` PRIMARY KEY(`keyHash`),
	CONSTRAINT `booking_submissions_reservationId_unique` UNIQUE(`reservationId`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `booking_notifications` ADD CONSTRAINT `booking_notifications_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_submissions` ADD CONSTRAINT `booking_submissions_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;