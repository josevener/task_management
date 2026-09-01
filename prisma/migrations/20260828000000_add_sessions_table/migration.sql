CREATE TABLE `sessions` (
  `sid` VARCHAR(255) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `expires_at` DATETIME NOT NULL,
  PRIMARY KEY (`sid`),
  INDEX `sessions_expires_at_idx` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
