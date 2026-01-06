const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * LIMPIEZA DE URL:
 * Eliminamos el "-a" automáticamente si existe para forzar la red interna de Render.
 * La red interna ignora las restricciones de IP (Inbound IP Restrictions).
 */
let dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
    dbUrl = dbUrl.replace('-a.', '.').replace('-a/', '/');
}

if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL no encontrada en Environment.');
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
 * Conexión con reintentos para manejar el arranque en frío de Render Free.
 */
const connectDB = async (retries = 5) => {
    while (retries) {
        try {
            console.log('📡 Intentando conexión interna segura...');
            await sequelize.authenticate();
            console.log('✅ ¡CONEXIÓN EXITOSA! El servidor está vinculado a la DB.');
            break;
        } catch (err) {
            console.error(`❌ Error (Reintentos restantes: ${retries - 1}):`, err.message);
            retries -= 1;
            if (retries === 0) {
                console.log('💡 TIP: Verifica las credenciales en el panel de Render.');
            }
            await new Promise(res => setTimeout(res, 3000));
        }
    }
};

connectDB();

module.exports = sequelize;