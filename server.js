/**
 *******************************************************************
 * GLauncher - Backend Principal (Adaptado para Render.com)
 *******************************************************************
 * 
 * Este archivo es el punto de entrada de la aplicación.
 * 
 * Estructura del Archivo:
 * 1.  IMPORTS: Carga de módulos y configuración inicial.
 * 2.  INICIALIZACIÓN DE EXPRESS: Creación de la instancia de la app.
 * 3.  CONFIGURACIÓN DE DIRECTORIOS: Ubicación de archivos estáticos y de subida.
 * 4.  MIDDLEWARE: Configuración de CORS, JSON parser, Passport, etc.
 * 5.  RUTAS: Conexión de los diferentes endpoints de la API.
 * 6.  SINCRONIZACIÓN Y ARRANQUE: Conexión a la BD y arranque del servidor.
 * 
 *******************************************************************
 */

// --- 1. IMPORTS ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const sequelize = require('./config/database');

// --- 2. INICIALIZACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. CONFIGURACIÓN DE DIRECTORIOS ---
// Directorios para archivos estáticos y subidas
const staticDir = path.join(__dirname, 'static');
const downloadsDir = path.join(__dirname, 'downloads');
const uploadsDir = path.join(__dirname, 'uploads');

console.log(`? Static files served from: ${staticDir}`);
console.log(`? Downloadable files location: ${downloadsDir}`);
console.log(`? Uploaded files location: ${uploadsDir}`);

app.use('/static', express.static(staticDir));
app.use('/uploads', express.static(uploadsDir));

// --- 4. MIDDLEWARE ---
// CORS para permitir peticiones del cliente
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));

// Body Parsers para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialización de Passport para autenticación
app.use(passport.initialize());


// --- 5. RUTAS ---
console.log("? Cargando rutas de la API...");

// [CORRECCIÓN] Se registra el enrutador de autenticación sin prefijo global
// para permitir URLs limpias como '/login/google' y al mismo tiempo
// mantener las rutas de la API como '/api/auth/login'.
app.use(require('./routes/auth'));

// Se registra el resto de las rutas de la API con el prefijo '/api'
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/friendship'));
app.use('/api', require('./routes/news'));
app.use('/api', require('./routes/downloads'));
app.use('/api', require('./routes/shop'));
app.use('/api', require('./routes/achievements'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/gchat'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/pusher-auth'));
app.use('/api', require('./routes/communityWall'));
console.log("? Rutas cargadas exitosamente.");

// Endpoint de bienvenida
app.get('/', (req, res) => {
    res.send('<h1>? GLauncher Backend</h1><p>El servidor está operativo. ¡Bienvenido!</p>');
});

// --- 6. SINCRONIZACIÓN Y ARRANQUE ---
// Sincronizar modelos y arrancar el servidor
sequelize.sync({ force: false })
    .then(() => {
        console.log('?? Database & tables synced successfully!');
        app.listen(PORT, () => {
            console.log(`?? Server running on port ${PORT}. Ready to accept connections.`);
        });
    })
    .catch(err => {
        console.error('?? Critical Error: Unable to sync database:', err.message);
        console.error('?? The application will exit.');
        process.exit(1); // Salir si la BD no se puede sincronizar
    });

// Exportar la app para posibles pruebas
module.exports.app = app;
