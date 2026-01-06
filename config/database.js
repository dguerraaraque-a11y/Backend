const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * CONFIGURACIÓN DE BASE DE DATOS MEJORADA
 * Este código utiliza directamente la URL de la base de datos proporcionada por el entorno.
 */
const dbUrl = process.env.DATABASE_URL;

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
            console.log('📡 Intentando conexión a la base de datos...');
            await sequelize.authenticate();
            console.log('✅ ¡CONEXIÓN EXITOSA! El backend está listo y operando.');
            break;
        } catch (err) {
            console.error(`❌ Error de conexión (Intentos restantes: ${retries - 1}):`, err.message);
            retries -= 1;
            if (retries === 0) {
                console.log('💡 TIP: Verifica que la variable de entorno DATABASE_URL sea la correcta en Render.');
            }
            // Esperar 3 segundos antes de reintentar
            await new Promise(res => setTimeout(res, 3000));
        }
    }
};

connectDB();

module.exports = sequelize;