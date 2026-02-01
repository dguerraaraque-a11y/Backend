/**
 *******************************************************************
 * GLauncher - Backend Principal (Adaptado para Render.com)
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

// [CORRECCIÓN] Confiar en el proxy de Render.com para solucionar el error 'redirect_uri_mismatch'
// al generar la URL de callback de Google con https://.
app.set('trust proxy', 1);

// --- 3. CONFIGURACIÓN DE DIRECTORIOS ---
const staticDir = path.join(__dirname, 'static');
app.use('/static', express.static(staticDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 4. MIDDLEWARE ---
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'https://glauncher.vercel.app'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());


// --- 5. RUTAS ---
console.log("? Cargando rutas de la API...");
app.use(require('./routes/auth')); 
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/friendship'));
app.use('/api', require('./routes/downloads'));
app.use('/api', require('./routes/shop'));
app.use('/api', require('./routes/achievements'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/gchat'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/pusher-auth'));
app.use('/api', require('./routes/communityWall'));
app.use('/api/news', require('./routes/news')); // Corrected route
console.log("? Rutas cargadas exitosamente.");

// [MODIFICACIÓN] Servir la suite de pruebas 'test_suite.html' en la ruta raíz.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'test_suite.html'));
});

// --- 6. SINCRONIZACIÓN Y ARRANQUE ---
sequelize.sync({ force: false })
    .then(() => {
        console.log('?? Database & tables synced successfully!');
        app.listen(PORT, () => {
            console.log(`?? Server running on port ${PORT}. Ready to accept connections.`);
        });
    })
    .catch(err => {
        console.error('?? Critical Error: Unable to sync database:', err.message);
        process.exit(1); 
    });

module.exports.app = app;
