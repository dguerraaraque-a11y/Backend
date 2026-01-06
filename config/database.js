const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
require('dotenv').config();

const currentDir = __dirname;
const staticDir = path.join(currentDir, '..', 'static');
const dataDir = path.join(staticDir, 'data');

// Asegurar que el directorio data exista
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const localDbPath = path.join(dataDir, 'glauncher.db');

let sequelize;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    console.log('📡 Conectando a PostgreSQL en Render...');
    
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false, 
        dialectOptions: {
            ssl: {
                require: true, // Render SIEMPRE requiere SSL
                rejectUnauthorized: false // Permite certificados autofirmados de Render
            },
            keepAlive: true
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
} else {
    console.log('📂 Usando SQLite local...');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: localDbPath,
        logging: false,
    });
}

// Prueba de conexión inmediata
sequelize.authenticate()
    .then(() => {
        console.log('✅ ¡Conexión exitosa con la base de datos de Render!');
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err.message);
        console.log('💡 Revisa que tu IP no esté bloqueada en Render o que la URL sea correcta.');
    });

module.exports = sequelize;