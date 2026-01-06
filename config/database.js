const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * CONFIGURACIÓN DE BASE DE DATOS MEJORADA
 * Este código corrige automáticamente el hostname de Render si falta la región.
 */
let dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
    // Si el link es interno y no tiene la región, se la agregamos para evitar el ENOTFOUND
    if (dbUrl.includes('dpg-') && !dbUrl.includes('-ohio-postgres')) {
        dbUrl = dbUrl.replace('dpg-d5e0jm63jp1c73f65a60', 'dpg-d5e0jm63jp1c73f65a60-ohio-postgres');
    }
    // Limpieza de cualquier sufijo '-a' residual
    dbUrl = dbUrl.replace('-a.', '.').replace('-a/', '/');
}

if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL no definida en el panel de Render.');
    process.exit(1);
}

const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false 
        },
        keepAlive: true
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 60000, 
        idle: 10000,
        evict: 1000   
    }
});

/**
 * Conexión con reintentos para soportar el arranque de la base de datos
 */
const connectDB = async (retries = 5) => {
    while (retries) {
        try {
            console.log('📡 Intentando conexión interna (Host validado)...');
            await sequelize.authenticate();
            console.log('✅ ¡CONEXIÓN EXITOSA! El backend está listo y operando.');
            break;
        } catch (err) {
            console.error(`❌ Error (Intentos restantes: ${retries - 1}):`, err.message);
            retries -= 1;
            if (retries === 0) {
                console.log('💡 TIP: Asegúrate de que el hostname incluya "-ohio-postgres".');
            }
            // Esperar 3 segundos antes de reintentar
            await new Promise(res => setTimeout(res, 3000));
        }
    }
};

connectDB();

module.exports = sequelize;