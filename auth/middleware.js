const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autenticado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.userId = decoded.user_id;
        req.username = decoded.username;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado.' });
        }
        return res.status(401).json({ message: 'Token inválido.' });
    }
};

const adminRequired = async (req, res, next) => {
    // Ensure verifyToken has run first to populate req.userId
    if (!req.userId) {
        return res.status(401).json({ message: 'Acceso denegado. No autenticado.' });
    }

    try {
        const user = await User.findByPk(req.userId);
        if (!user || !user.is_admin) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permisos de administrador.' });
        }
        req.user = user; // Attach user object to request for further use
        next();
    } catch (error) {
        console.error('Error en middleware adminRequired:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

const publicEndpoint = (req, res, next) => {
    // This middleware simply allows the request to proceed
    next();
};

module.exports = { verifyToken, adminRequired, publicEndpoint };
