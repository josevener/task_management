CREATE TABLE `workspace_invitations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_id` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role_id` INTEGER NOT NULL,
    `invited_by_user_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,
    `accepted_at` TIMESTAMP(0) NULL,
    `revoked_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `workspace_invitations_token_hash_key`(`token_hash`),
    UNIQUE INDEX `unique_workspace_invitation`(`workspace_id`, `email`),
    INDEX `workspace_invitations_email_idx`(`email`),
    INDEX `workspace_invitations_expires_at_idx`(`expires_at`),
    INDEX `workspace_invitations_role_id_idx`(`role_id`),
    INDEX `workspace_invitations_invited_by_idx`(`invited_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `workspace_invitations`
    ADD CONSTRAINT `workspace_invitations_workspace_id_fkey`
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workspace_invitations`
    ADD CONSTRAINT `workspace_invitations_role_id_fkey`
    FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `workspace_invitations`
    ADD CONSTRAINT `workspace_invitations_invited_by_user_id_fkey`
    FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
