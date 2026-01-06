// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const Pusher = require('pusher');
const fs = require('fs');
const sequelize = require('./config/database');

// --- 1. CONFIGURACIÓN DE PUSHER (DEBE IR ANTES DE LAS RUTAS) ---
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});

// Exportar inmediatamente para evitar avisos de "circular dependency"
module.exports = { pusher };

// --- 2. CONFIGURACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3000;

// Import all models
require('./models/User');
require('./models/Friendship');
require('./models/Achievement');
require('./models/UserAchievement');
require('./models/AchievementReaction');
require('./models/LaunchMessage');
require('./models/ChatMessage');
require('./models/PrivateMessage');
require('./models/News');
require('./models/Download');
require('./models/CosmeticItem');
require('./models/UserCosmetic');

// Passport setup
const passport = require('passport');
app.use(passport.initialize());

// Middleware
app.use(cors({ credentials: true, origin: 'https://glauncher.vercel.app' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 3. DIRECTORIOS ESTÁTICOS ---
const staticDir = path.join(__dirname, 'static');
const modelsDir = path.join(staticDir, 'models');
const frontendDir = path.join(__dirname, '..', 'GLAUNCHER-WEB');

// Crear directorios si no existen
const dirs = [
    modelsDir,
    path.join(staticDir, 'data'),
    path.join(frontendDir, 'downloads'),
    path.join(frontendDir, 'uploads', 'chat'),
    path.join(staticDir, 'images', 'avatars'),
    path.join(staticDir, 'images', 'shop')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Servir archivos
app.use('/static', express.static(staticDir));
app.use('/images', express.static(path.join(staticDir, 'images')));
app.use('/models', express.static(modelsDir));
app.use('/downloads', express.static(path.join(frontendDir, 'downloads')));
app.use('/uploads/chat', express.static(path.join(frontendDir, 'uploads', 'chat')));

// --- 4. RUTAS (AHORA SÍ PUEDEN IMPORTAR PUSHER) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(staticDir, 'test_suite.html'));
});

// Importación de rutas
app.use(require('./routes/auth'));
app.use(require('./routes/user'));
app.use(require('./routes/friendship'));
app.use(require('./routes/news'));
app.use(require('./routes/downloads'));
app.use(require('./routes/shop'));
app.use(require('./routes/achievements'));
app.use(require('./routes/admin'));
app.use(require('./routes/gchat'));
app.use(require('./routes/chat'));
app.use(require('./routes/pusher-auth'));
app.use(require('./routes/communityWall'));

// --- 5. SINCRONIZACIÓN Y ARRANQUE ---
sequelize.sync({ force: false })
    .then(() => {
        console.log('? Database & tables connected/synced!');
        app.listen(PORT, () => {
            console.log(`? Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('?? Unable to connect to the database:', err.message);
        console.log('?? TIP: Revisa si tu IP esta en el Allowlist de Render.');
    });

// Exportar app al final
module.exports.app = app;