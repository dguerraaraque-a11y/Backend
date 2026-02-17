const express = require('express');
const jwt = require('jsonwebtoken');
// const User = require('../models/User'); // Comentado para versión standalone

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_dev';

// Base de datos simulada en memoria (Mock)
const users = [
    { id: 1, username: 'user', password: 'password', role: 'user' },
    { id: 2, username: 'admin', password: 'admin', role: 'admin' },
    { id: 3, username: 'friend', password: 'password', role: 'user' }
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
    userProfiles: { 1: { bio: 'Gamer', status: 'Online' }, 2: { bio: 'Admin', status: 'Away' } }
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

// --- RUTAS DEL BACKEND ---

// Ruta de bienvenida (news.js)
app.get('/', (req, res) => res.json({ message: 'Welcome to GLauncher API' }));

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

// --- achievements.js ---
app.post('/api/achievements/react', loginRequired, (req, res) => {
    res.json({ message: 'Achievement reaction received', user: req.user.username, body: req.body });
});

// --- admin.js ---
app.post('/api/admin/cosmetics/create', loginRequired, adminRequired, (req, res) => res.status(201).json({ message: 'Cosmetic created', data: req.body }));
app.delete('/api/admin/cosmetics/:id', loginRequired, adminRequired, (req, res) => res.json({ message: `Cosmetic ${req.params.id} deleted` }));
app.get('/api/admin/users', loginRequired, adminRequired, (req, res) => res.json(users));
app.post('/api/admin/update_user', loginRequired, adminRequired, (req, res) => res.json({ message: 'User updated', data: req.body }));
app.post('/api/admin/users/ban', loginRequired, adminRequired, (req, res) => res.json({ message: 'User banned', data: req.body }));
app.post('/api/admin/wipe_all_data', loginRequired, adminRequired, (req, res) => res.status(200).json({ message: 'All data wiped by admin' }));
app.post('/api/gemini-chat', loginRequired, (req, res) => res.json({ reply: 'This is a mock response from Gemini.' }));
app.get('/api/youtube/search', loginRequired, (req, res) => res.json({ results: [`Video for query: ${req.query.q}`] }));
app.get('/api/admin/status', loginRequired, adminRequired, (req, res) => res.json({ status: 'ok', version: '1.0.0' }));
app.get('/create_first_admin', (req, res) => {
    // En un caso real, esto tendría lógica para crear el primer admin si no existe.
    res.json({ message: 'Endpoint for initial admin setup.' });
});

// --- auth.js ---
app.get('/login/google', (req, res) => res.send('Redirecting to Google for authentication...'));
app.get('/auth/google/callback', (req, res) => {
    const user = users[0]; // Simula un usuario que regresa de Google
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Google auth successful (mock)', token });
});
app.get('/api/user/me', loginRequired, (req, res) => res.json(req.user));

// --- chat.js ---
app.get('/api/chat_messages', loginRequired, (req, res) => res.json(mockData.chatMessages));
app.post('/api/chat_messages/create', loginRequired, (req, res) => res.status(201).json({ message: 'Chat message created', data: req.body }));
app.delete('/api/chat_messages/:message_id', loginRequired, adminRequired, (req, res) => res.json({ message: `Message ${req.params.message_id} deleted` }));
app.delete('/api/chat_messages/all', loginRequired, adminRequired, (req, res) => res.json({ message: 'All chat messages deleted' }));

// --- communityWall.js ---
app.get('/api/launch_messages', loginRequired, (req, res) => res.json(mockData.launchMessages));
app.post('/api/launch_messages/create', loginRequired, (req, res) => res.status(201).json({ message: 'Launch message created', data: req.body }));

// --- downloads.js ---
app.get('/api/downloads', (req, res) => res.json(mockData.downloads));
app.get('/api/download/windows', (req, res) => res.download('./package.json', 'GLauncher-Installer.exe')); // Simula una descarga
app.get('/api/updates/latest', (req, res) => res.json({ version: '1.1.0', notes: 'Bug fixes and improvements' }));
app.get('/api/download/update-jar', (req, res) => res.download('./package.json', 'update.jar')); // Simula una descarga
app.post('/api/downloads/create', loginRequired, adminRequired, (req, res) => res.status(201).json({ message: 'Download entry created', data: req.body }));
app.delete('/api/downloads/delete/:download_id', loginRequired, adminRequired, (req, res) => res.json({ message: `Download ${req.params.download_id} deleted` }));

// --- friendship.js ---
app.get('/api/friends', loginRequired, (req, res) => {
    const userFriends = mockData.friendships.filter(f => f.userId1 === req.user.id || f.userId2 === req.user.id);
    res.json(userFriends);
});
app.post('/api/friends/add', loginRequired, (req, res) => res.json({ message: `Friend request sent to user ${req.body.friendId}` }));
app.post('/api/friends/accept', loginRequired, (req, res) => res.json({ message: `Friend request from ${req.body.friendId} accepted` }));
app.post('/api/friends/remove', loginRequired, (req, res) => res.json({ message: `Friend ${req.body.friendId} removed` }));

// --- gchat.js ---
app.get('/api/gchat/history/:friend_id', loginRequired, (req, res) => {
    const key = [req.user.id, req.params.friend_id].sort().join('-');
    res.json(mockData.gchatHistory[key] || []);
});
app.post('/api/gchat/send/:recipient_id', loginRequired, (req, res) => res.json({ message: `Message sent to ${req.params.recipient_id}` }));
app.post('/api/gchat/typing', loginRequired, (req, res) => res.json({ message: `User ${req.user.username} is typing...` }));
app.post('/api/gchat/upload_attachment', loginRequired, (req, res) => res.status(201).json({ message: 'Attachment uploaded' }));

// --- pusher-auth.js ---
app.post('/pusher/auth', loginRequired, (req, res) => {
    // Lógica de autenticación de Pusher simulada
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    // Para canales privados (private-), el nombre debe coincidir con el ID de usuario
    if (channel.endsWith(req.user.id)) {
        const auth = { auth: "mock_pusher_auth_key" }; // Simulación
        res.send(auth);
    } else {
        res.status(403).send('Forbidden');
    }
});

// --- shop.js ---
app.post('/api/shop/claim_daily_reward', loginRequired, (req, res) => res.json({ message: 'Daily reward claimed!', reward: '100 coins' }));
app.get('/api/shop/items', loginRequired, (req, res) => res.json(mockData.shopItems));
app.post('/api/shop/purchase', loginRequired, (req, res) => res.json({ message: `Item ${req.body.itemId} purchased successfully` }));

// --- user.js ---
app.get('/api/user_info', loginRequired, (req, res) => {
    const userId = req.query.userId || req.user.id;
    const user = users.find(u => u.id == userId);
    const profile = mockData.userProfiles[userId];
    if (user) {
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            ...profile
        });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});
app.get('/api/users/search', loginRequired, (req, res) => {
    const query = req.query.q.toLowerCase();
    const results = users.filter(u => u.username.toLowerCase().includes(query));
    res.json(results.map(u => ({ id: u.id, username: u.username })));
});
app.post('/api/user/update_profile', loginRequired, (req, res) => {
    mockData.userProfiles[req.user.id] = { ...mockData.userProfiles[req.user.id], ...req.body };
    res.json({ message: 'Profile updated', profile: mockData.userProfiles[req.user.id] });
});
app.post('/api/user/status', loginRequired, (req, res) => {
    mockData.userProfiles[req.user.id].status = req.body.status;
    res.json({ message: `Status updated to ${req.body.status}` });
});

module.exports = { app, loginRequired, adminRequired, publicEndpoint };