/**
 * GLauncher - Rutas de Autenticación
 * 
 * Este archivo maneja:
 * 1. El registro de nuevos usuarios locales.
 * 2. El inicio de sesión local (No-Premium).
 * 3. El inicio de sesión con proveedores OAuth (Google, Microsoft).
 */

const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // [CORREGIDO] Ruta del modelo de usuario
const { adminRequired, loginRequired } = require('../auth/middleware'); // [NUEVO] Importar middlewares

const router = express.Router();

// --- Rutas de Estrategia de Google ---

// Redirige al usuario a Google para que se autentique.
router.get('/login/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false // No crear sesiones en el backend
}));

// Callback de Google. Se ejecuta después de que el usuario se loguea en Google.
router.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', { 
        session: false,
        failureRedirect: 'https://glauncher.vercel.app/login?error=auth_failed' 
    }, (err, user, info) => {
        if (err || !user) {
            return res.redirect('https://glauncher.vercel.app/login?error=auth_failed');
        }

        // Si el usuario es nuevo y necesita completar el perfil
        if (user.isNew) {
            // Generar un token temporal para el setup del perfil
            const setupToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
            return res.redirect(`https://glauncher.vercel.app/setup-profile?setup_token=${setupToken}`);
        }

        // Si el usuario ya existe, generar token de sesión y redirigir
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.redirect(`https://glauncher.vercel.app/login/callback?token=${token}`);

    })(req, res, next);
});


// --- [NUEVO] Rutas para la API del Launcher ---

/**
 * GET /api/user_info
 * Devuelve la información del usuario autenticado (protegido por token JWT).
 */
router.get('/api/user/me', loginRequired, async (req, res) => {
    try {
        // El middleware loginRequired ya ha verificado el token y ha adjuntado el usuario a req.user
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'nickname', 'email', 'avatar_url', 'skin_url', 'role']
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json(user);
    } catch (error) {
        console.error("Error al obtener información del usuario:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;