CREATE TABLE `payment_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`activeReservationId` int,
	`requestKeyHash` varchar(64) NOT NULL,
	`reference` varchar(80) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`reservationRevision` varchar(64) NOT NULL,
	`mode` enum('mock','test') NOT NULL,
	`status` enum('initializing','pending','succeeded','failed','abandoned','review required') NOT NULL DEFAULT 'initializing',
	`providerTransactionId` varchar(80),
	`providerStatus` varchar(40),
	`authorizationUrl` text,
	`lastErrorCode` varchar(80),
	`mockOutcome` varchar(20) NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempts_activeReservationId_unique` UNIQUE(`activeReservationId`),
	CONSTRAINT `payment_attempts_requestKeyHash_unique` UNIQUE(`requestKeyHash`),
	CONSTRAINT `payment_attempts_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `payment_attempts_providerTransactionId_unique` UNIQUE(`providerTransactionId`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`eventKey` varchar(64) NOT NULL,
	`source` varchar(30) NOT NULL,
	`status` varchar(40) NOT NULL,
	`reason` varchar(80),
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_eventKey_unique` UNIQUE(`eventKey`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_reservationId_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_activeReservationId_reservations_id_fk` FOREIGN KEY (`activeReservationId`) REFERENCES `reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_attemptId_payment_attempts_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;