const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');

const router = express.Router();

// La URL a la que el backend redirigirá al usuario DESPUÉS de un login social exitoso.
// Esta página se encargará de pasar el token a la ventana principal.
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'https://glauncher-web.vercel.app/redirect.html';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://glauncher-api.onrender.com';

// --- Simplified GLauncher Account Login ---
router.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
        }
        if (user.is_banned && user.banned_until && new Date() < user.banned_until) {
            const timeLeft = user.banned_until.getTime() - new Date().getTime();
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            return res.status(403).json({ message: `Tu cuenta está suspendida. Tiempo restante: ${days}d ${hours}h.` });
        }
        if (!user.password_hash) {
            return res.status(401).json({ message: 'Esta cuenta fue creada con un proveedor social. Intenta iniciar sesión con Google o Microsoft.' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
        }
        const token = jwt.sign({ user_id: user.id, username: user.username }, process.env.SECRET_KEY, { algorithm: 'HS256' });
        return res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token: token,
            username: user.username
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// --- User Registration ---
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nombre de usuario y contraseña son requeridos.' });
    }
    try {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'El nombre de usuario ya existe.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            password_hash: hashedPassword,
            provider: 'glauncher',
            security_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        });
        return res.status(201).json({ success: true, message: '¡Registro exitoso! Ahora puedes iniciar sesión.' });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// --- Social Login (Google, Microsoft) --- //

// Passport.js Configuration
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // FIX: Usar URL de callback absoluta
        callbackURL: `${BACKEND_API_URL}/auth/google/callback`,
        scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ where: { social_id: profile.id, provider: 'google' } });
            if (!user) {
                let username = profile.displayName || (profile.emails && profile.emails[0] && profile.emails[0].value.split('@')[0]) || `user${profile.id}`;
                const existingUser = await User.findOne({ where: { username } });
                if (existingUser) { // Si el username sugerido ya existe, añade un sufijo
                    username = `${username}${Math.floor(Math.random() * 999)}`;
                }
                user = await User.create({
                    username: username,
                    provider: 'google',
                    social_id: profile.id,
                    avatar_url: (profile.photos && profile.photos[0]) ? profile.photos[0].value : null,
                });
            }
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }));
}

if (process.env.MICROSOFT_CLIENT_ID) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        // FIX: Usar URL de callback absoluta
        callbackURL: `${BACKEND_API_URL}/auth/microsoft/callback`,
        scope: ['user.read'],
        tenant: 'common', // Aceptar tanto cuentas personales como de trabajo
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ where: { social_id: profile.id, provider: 'microsoft' } });
            if (!user) {
                let username = profile.displayName || (profile.emails && profile.emails[0] && profile.emails[0].value.split('@')[0]) || `user${profile.id}`;
                const existingUser = await User.findOne({ where: { username } });
                if (existingUser) { // Si el username sugerido ya existe, añade un sufijo
                    username = `${username}${Math.floor(Math.random() * 999)}`;
                }
                user = await User.create({
                    username: username,
                    provider: 'microsoft',
                    social_id: profile.id,
                    avatar_url: null, // API de Graph no provee foto por defecto en scope 'user.read'
                });
            }
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Social Auth Routes
router.get('/login/google', passport.authenticate('google', { session: false }));
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: FRONTEND_REDIRECT_URL, session: false }),
    (req, res) => {
        const token = jwt.sign({ user_id: req.user.id, username: req.user.username }, process.env.SECRET_KEY, { algorithm: 'HS256' });
        // Redirige a la página que puede comunicarse con la ventana principal
        res.redirect(`${FRONTEND_REDIRECT_URL}?token=${token}`);
    }
);

router.get('/login/microsoft', passport.authenticate('microsoft', { session: false }));
router.get('/auth/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: FRONTEND_REDIRECT_URL, session: false }),
    (req, res) => {
        const token = jwt.sign({ user_id: req.user.id, username: req.user.username }, process.env.SECRET_KEY, { algorithm: 'HS256' });
        res.redirect(`${FRONTEND_REDIRECT_URL}?token=${token}`);
    }
);

module.exports = router;
