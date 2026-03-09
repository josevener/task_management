<?php
/**
 * Database Connection Utility
 * 
 * Provides a singleton PDO connection to the database.
 * Uses prepared statements for security.
 */

require_once __DIR__ . '/../config/database.php';

class Database {
  private static $instance = null;
  private $pdo = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private function __construct() {
    $config = require __DIR__ . '/../config/database.php';
    
    $dsn = sprintf(
      'mysql:host=%s;port=%d;dbname=%s;charset=%s',
      $config['host'],
      $config['port'],
      $config['database'],
      $config['charset']
    );

    try {
      $this->pdo = new PDO(
        $dsn,
        $config['username'],
        $config['password'],
        $config['options']
      );
    } catch (PDOException $e) {
      error_log('Database connection failed: ' . $e->getMessage());
      throw new Exception('Database connection failed. Please check your configuration.');
    }
  }

  /**
   * Get the singleton database instance
   * 
   * @return Database
   */
  public static function getInstance() {
    if (self::$instance === null) {
      self::$instance = new self();
    }
    return self::$instance;
  }

  /**
   * Get the PDO connection
   * 
   * @return PDO
   */
  public function getConnection() {
    return $this->pdo;
  }

  /**
   * Prevent cloning of the instance
   */
  private function __clone() {}

  /**
   * Prevent unserialization of the instance
   */
  public function __wakeup() {
    throw new Exception('Cannot unserialize singleton');
  }
}
