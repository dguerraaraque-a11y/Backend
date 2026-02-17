const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify if the user is authenticated via JWT.
 */
const loginRequired = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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

    // Fallback: Check in database (if User model is available)
    if (User && typeof User.findByPk === 'function') {
        try {
            const user = await User.findByPk(req.user.id);
            if (user && user.role === 'admin') {
                return next();
            }
        } catch (error) {
            console.error("Error checking admin permissions:", error);
        }
    }

    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
};

/**
 * Middleware for public endpoints (placeholder).
 */
const publicEndpoint = (req, res, next) => {
    next();
};

module.exports = { loginRequired, adminRequired, publicEndpoint };