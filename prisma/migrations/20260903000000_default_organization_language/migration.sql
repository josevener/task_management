UPDATE `organizations`
SET `default_language` = 'en'
WHERE `default_language` IS NULL OR `default_language` = '';

ALTER TABLE `organizations`
  MODIFY `default_language` VARCHAR(20) NOT NULL DEFAULT 'en';
