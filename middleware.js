const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
// const User = require('../models/User'); // Comentado para versión standalone

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_dev';

// Base de datos simulada en memoria (Mock)
const users = [
    { id: 1, username: 'user', password: 'password', role: 'user' },
    { id: 2, username: 'admin', password: 'admin', role: 'admin' }
];

const mockData = {
    achievements: [],
    cosmetics: [{ id: 1, name: 'Cool Hat', price: 100 }],
    chatMessages: [{ id: 1, userId: 1, message: 'Hello world!' }],
    launchMessages: [{ id: 1, userId: 1, message: 'First launch!' }],
    downloads: [{ download_id: 1, name: 'Game Client v1.0', url: '/downloads/client.zip' }],
    friendships: [{ userId1: 1, userId2: 2, status: 'accepted' }],
    gchatHistory: { '1-3': [{ senderId: 1, recipient_id: 3, message: 'Hey!' }] },
    shopItems: [{ id: 1, name: 'Gold Sword', price: 500 }],
    userProfiles: { 1: { bio: 'Gamer', status: 'Online' }, 2: { bio: 'Admin', status: 'Away' } },
    news: [
        { id: 1, title: 'Welcome to GLauncher', content: 'We are live!', date: '2023-10-27' },
        { id: 2, title: 'Patch Notes v1.1', content: 'Bug fixes and performance improvements.', date: '2023-11-01' }
    ]
};

/**
 * Middleware to verify if the user is authenticated via JWT.
 */
const loginRequired = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }
        req.user = user;
        next();
    });
};

/**
 * Middleware to verify if the user has admin privileges.
 */
const adminRequired = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Acceso denegado. Usuario no autenticado.' });
    }

    // Check if role is present in the token payload
    if (req.user.role === 'admin') {
        return next();
    }

    // Fallback: Verificar en base de datos mock
    const user = users.find(u => u.id === req.user.id);
    if (user && user.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
};

/**
 * Middleware for public endpoints (placeholder).
 */
const publicEndpoint = (req, res, next) => {
    next();
};

// --- HTML Generator for Neon Loading ---
const getNeonLoaderHtml = (provider, targetUrl) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conectando con ${provider}...</title>
    <style>
        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #050505; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        .loader-container { position: relative; display: flex; flex-direction: column; align-items: center; }
        .loader { position: relative; width: 150px; height: 150px; border-radius: 50%; background: linear-gradient(45deg, transparent, transparent 40%, #00ff0a); animation: animate 2s linear infinite; }
        .loader::before { content: ''; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; background: #050505; border-radius: 50%; z-index: 1000; }
        .loader::after { content: ''; position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; background: linear-gradient(45deg, transparent, transparent 40%, #00ff0a); border-radius: 50%; z-index: 1; filter: blur(30px); }
        @keyframes animate { 0% { transform: rotate(0deg); filter: hue-rotate(0deg); } 100% { transform: rotate(360deg); filter: hue-rotate(360deg); } }
        h2 { color: #fff; margin-top: 20px; letter-spacing: 2px; text-transform: uppercase; font-size: 1.2rem; z-index: 1001; text-shadow: 0 0 10px #00ff0a; }
    </style>
</head>
<body>
    <div class="loader-container">
        <div class="loader"></div>
        <h2>Redirigiendo a ${provider}</h2>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = '${targetUrl}';
        }, 2500);
    </script>
</body>
</html>
`;

const getSuccessHtml = (token, targetUrl) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autenticación Exitosa</title>
    <style>
        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #050505; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        .loader-container { position: relative; display: flex; flex-direction: column; align-items: center; }
        .loader { position: relative; width: 150px; height: 150px; border-radius: 50%; background: linear-gradient(45deg, transparent, transparent 40%, #00ff0a); animation: animate 2s linear infinite; }
        .loader::before { content: ''; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; background: #050505; border-radius: 50%; z-index: 1000; }
        .loader::after { content: ''; position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; background: linear-gradient(45deg, transparent, transparent 40%, #00ff0a); border-radius: 50%; z-index: 1; filter: blur(30px); }
        @keyframes animate { 0% { transform: rotate(0deg); filter: hue-rotate(0deg); } 100% { transform: rotate(360deg); filter: hue-rotate(360deg); } }
        h2 { color: #fff; margin-top: 20px; letter-spacing: 2px; text-transform: uppercase; font-size: 1.2rem; z-index: 1001; text-shadow: 0 0 10px #00ff0a; }
        p { color: #aaa; margin-top: 10px; font-size: 0.9rem; z-index: 1001; }
    </style>
</head>
<body>
    <div class="loader-container">
        <div class="loader"></div>
        <h2>¡Autenticación Exitosa!</h2>
        <p>Redirigiendo a GLauncher...</p>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = '${targetUrl}?token=${token}';
        }, 2000);
    </script>
</body>
</html>
`;

// --- RUTAS DEL BACKEND ---

app.get('/', (req, res) => res.json({ message: 'Welcome to GLauncher API' }));
app.get('/api/news', (req, res) => res.json(mockData.news));

app.get('/login/google', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/auth/google/callback`;
    const clientId = '71330665801-6joq0752g7hhhp2hmld06hrfg67rhji0.apps.googleusercontent.com';
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile%20email`;
    res.send(getNeonLoaderHtml('Google', googleUrl));
});

app.get('/auth/google/callback', (req, res) => {
    const user = users[0]; 
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const targetUrl = 'https://glauncher.vercel.app/register-complete.html';
    res.send(getSuccessHtml(token, targetUrl));
});

app.get('/login/microsoft', (req, res) => res.send(getNeonLoaderHtml('Microsoft', '/auth/microsoft/callback')));
app.get('/auth/microsoft/callback', (req, res) => {
    const user = users[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Microsoft auth successful (mock)', token });
});

const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/auth/complete_registration', loginRequired, upload.single('profile_picture'), (req, res) => {
    const userId = req.user.id;
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const { username, password, phone_number } = req.body;
    if (username) users[userIndex].username = username;
    if (password) users[userIndex].password = password;

    if (!mockData.userProfiles[userId]) mockData.userProfiles[userId] = {};
    if (phone_number) mockData.userProfiles[userId].phone_number = phone_number;

    if (req.file) {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        mockData.userProfiles[userId].profile_picture = base64Image;
    }

    const token = jwt.sign({ id: userId, username: users[userIndex].username, role: users[userIndex].role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Registro completado con éxito.', token });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Credenciales incorrectas' });
    }
});

app.get('/protected', loginRequired, (req, res) => {
    res.json({ message: 'Accediste a una ruta protegida', user: req.user });
});

app.get('/admin', loginRequired, adminRequired, (req, res) => {
    res.json({ message: 'Accediste al panel de administración' });
});

module.exports = { app, loginRequired, adminRequired, publicEndpoint };