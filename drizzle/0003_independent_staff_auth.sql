CREATE TABLE `staff_auth_limits` (
	`bucketKey` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	CONSTRAINT `staff_auth_limits_bucketKey` PRIMARY KEY(`bucketKey`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `staff_auth_setup` (
	`id` int NOT NULL,
	`completedAt` timestamp,
	CONSTRAINT `staff_auth_setup_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `staff_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(254) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('user','staff','admin') NOT NULL DEFAULT 'user',
	`enabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_credentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `staff_credentials_email_unique` UNIQUE(`email`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`tokenHash` varchar(64) NOT NULL,
	`credentialId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_sessions_tokenHash` PRIMARY KEY(`tokenHash`)
) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `staff_credentials` ADD CONSTRAINT `staff_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_credentialId_staff_credentials_id_fk` FOREIGN KEY (`credentialId`) REFERENCES `staff_credentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_sessions_credential` ON `staff_sessions` (`credentialId`);