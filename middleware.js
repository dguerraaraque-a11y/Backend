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

// Iniciar el servidor si se ejecuta directamente
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}

module.exports = { app, loginRequired, adminRequired, publicEndpoint };