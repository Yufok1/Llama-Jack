/**
 * AsyncFS - Consistent async filesystem utilities
 * Provides promise-based wrappers for common fs operations with error handling
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class AsyncFS {
    /**
     * Safely read a file, returning null if it doesn't exist
     * @param {string} filePath - Path to file
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {Promise<string|null>} - File content or null if not found
     */
    static async safeReadFile(filePath, encoding = 'utf8') {
        try {
            return await fs.readFile(filePath, encoding);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist
            }
            logger.warn(`Failed to read file ${filePath}: ${error.message}`);
            throw error; // Re-throw other errors
        }
    }

    /**
     * Safely read and parse JSON file, returning null if not found or invalid
     * @param {string} filePath - Path to JSON file
     * @returns {Promise<Object|null>} - Parsed JSON or null
     */
    static async safeReadJSON(filePath) {
        try {
            const content = await this.safeReadFile(filePath);
            if (content === null) return null;
            return JSON.parse(content);
        } catch (error) {
            logger.warn(`Failed to parse JSON from ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Safely write file with directory creation
     * @param {string} filePath - Path to file
     * @param {string} content - Content to write
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {Promise<boolean>} - Success status
     */
    static async safeWriteFile(filePath, content, encoding = 'utf8') {
        try {
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content, encoding);
            return true;
        } catch (error) {
            logger.error(`Failed to write file ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Safely write JSON file with formatting
     * @param {string} filePath - Path to JSON file
     * @param {Object} data - Data to write
     * @param {number} spaces - JSON formatting spaces (default: 2)
     * @returns {Promise<boolean>} - Success status
     */
    static async safeWriteJSON(filePath, data, spaces = 2) {
        try {
            const content = JSON.stringify(data, null, spaces);
            return await this.safeWriteFile(filePath, content);
        } catch (error) {
            logger.error(`Failed to write JSON to ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if file or directory exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} - Exists status
     */
    static async pathExists(filePath) {
        try {
            return await fs.pathExists(filePath);
        } catch (error) {
            logger.warn(`Error checking path existence ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensure directory exists, creating it if necessary
     * @param {string} dirPath - Directory path
     * @returns {Promise<boolean>} - Success status
     */
    static async ensureDir(dirPath) {
        try {
            await fs.ensureDir(dirPath);
            return true;
        } catch (error) {
            logger.error(`Failed to ensure directory ${dirPath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get file stats safely
     * @param {string} filePath - Path to file
     * @returns {Promise<fs.Stats|null>} - File stats or null
     */
    static async safeStats(filePath) {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist
            }
            logger.warn(`Failed to get stats for ${filePath}: ${error.message}`);
            throw error; // Re-throw other errors
        }
    }

    /**
     * List directory contents safely
     * @param {string} dirPath - Directory path
     * @returns {Promise<string[]>} - Directory contents or empty array
     */
    static async safeReaddir(dirPath) {
        try {
            return await fs.readdir(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // Directory doesn't exist
            }
            logger.warn(`Failed to read directory ${dirPath}: ${error.message}`);
            return [];
        }
    }

    /**
     * Copy file safely
     * @param {string} src - Source path
     * @param {string} dest - Destination path
     * @returns {Promise<boolean>} - Success status
     */
    static async safeCopy(src, dest) {
        try {
            await fs.ensureDir(path.dirname(dest));
            await fs.copy(src, dest);
            return true;
        } catch (error) {
            logger.error(`Failed to copy ${src} to ${dest}: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove file or directory safely
     * @param {string} filePath - Path to remove
     * @returns {Promise<boolean>} - Success status
     */
    static async safeRemove(filePath) {
        try {
            await fs.remove(filePath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return true; // Already doesn't exist
            }
            logger.warn(`Failed to remove ${filePath}: ${error.message}`);
            return false;
        }
    }
}

module.exports = AsyncFS;