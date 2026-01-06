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

// Verificamos si existe la URL de Postgres
if (process.env.DATABASE_URL) {
    console.log('📡 Conectando a PostgreSQL en Render...');
    
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false, 
        dialectOptions: {
            ssl: {
                require: true, 
                rejectUnauthorized: false // NECESARIO para Render
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
    console.log('📂 Usando SQLite local (No se encontro DATABASE_URL)...');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: localDbPath,
        logging: false,
    });
}

// Prueba de conexión inmediata para debug
sequelize.authenticate()
    .then(() => {
        console.log('✅ ¡Conexion exitosa con PostgreSQL en Render!');
    })
    .catch(err => {
        console.error('❌ Error de conexion:', err.message);
        console.log('💡 TIP: Verifica que tu IP este autorizada en el panel de Render (Access Control).');
    });

module.exports = sequelize;