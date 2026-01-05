const { Sequelize } = require('sequelize');
const path = require('path');

const currentDir = __dirname;
const staticDir = path.join(currentDir, '..', 'static');
const dataDir = path.join(staticDir, 'data');

// Ensure the data directory exists
require('fs').mkdirSync(dataDir, { recursive: true });

const localDbPath = path.join(dataDir, 'glauncher.db');

// Use DATABASE_URL for production (e.g., Render.com) or local SQLite
const DATABASE_URL = process.env.DATABASE_URL || `sqlite://${localDbPath}`;

let sequelize;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    // Configuration for PostgreSQL (e.g., Render.com)
    sequelize = new Sequelize(DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false, // Set to true to see SQL queries
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Required for self-signed certificates or when not using a trusted CA
            }
        }
    });
} else {
    // Configuration for SQLite (local development)
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: localDbPath,
        logging: false, // Set to true to see SQL queries
    });
}

module.exports = sequelize;
