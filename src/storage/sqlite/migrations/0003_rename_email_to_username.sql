ALTER TABLE `users` RENAME COLUMN `email` TO `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `display_name`;--> statement-breakpoint
DROP INDEX `users_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
