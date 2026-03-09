<?php
/**
 * Database Configuration
 * 
 * This file contains database connection settings.
 * Update these values according to your XAMPP MySQL configuration.
 */

return [
  'host' => 'localhost',
  'port' => 3306,
  'database' => 'task_management',
  'username' => 'root',
  'password' => '12345678',
  'charset' => 'utf8mb4',
  'options' => [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]
];
