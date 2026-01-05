const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');
const { update_user_role } = require('../utils/helpers'); // We will create this helper soon

const router = express.Router();

const FRONTEND_DASHBOARD_URL = process.env.FRONTEND_DASHBOARD_URL || 'https://glauncher.vercel.app/dashboard.html';
const FRONTEND_LOGIN_URL = process.env.FRONTEND_LOGIN_URL || 'https://glauncher.vercel.app/login.html';
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'https://glauncher.vercel.app/redirect.html';

// --- Passport.js Configuration ---
// Google OAuth
console.log('Loading GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('Loading GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set');
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email'],
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ where: { social_id: profile.id, provider: 'google' } });

        if (!user) {
            // Check if username exists, append suffix if it does
            let username = profile.displayName || profile.emails[0].value.split('@')[0];
            let existingUser = await User.findOne({ where: { username } });
            if (existingUser) {
                username = `${username}_${profile.id.substring(0, 4)}`;
            }

            user = await User.create({
                username: username,
                provider: 'google',
                social_id: profile.id,
                avatar_url: profile.photos[0].value,
                security_code: Math.random().toString(36).substring(2, 8).toUpperCase(), // Simple 6-char code
            });
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

// Microsoft OAuth
console.log('Loading MICROSOFT_CLIENT_ID:', process.env.MICROSOFT_CLIENT_ID ? 'Set' : 'Not Set');
console.log('Loading MICROSOFT_CLIENT_SECRET:', process.env.MICROSOFT_CLIENT_SECRET ? 'Set' : 'Not Set');
passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: '/auth/microsoft/callback',
    scope: ['user.read'],
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ where: { social_id: profile.id, provider: 'microsoft' } });

        if (!user) {
            let username = profile.displayName || profile.emails[0].value.split('@')[0];
            let existingUser = await User.findOne({ where: { username } });
            if (existingUser) {
                username = `${username}_${profile.id.substring(0, 4)}`;
            }
            user = await User.create({
                username: username,
                provider: 'microsoft',
                social_id: profile.id,
                avatar_url: profile.photos && profile.photos[0] ? profile.photos[0].value : null, // Microsoft might not always provide a photo directly
                security_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            });
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

// Passport session setup (required for social login, but we'll use JWTs after initial auth)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// --- Local Authentication Routes ---

// Step 1: Check credentials (username and password)
router.post('/api/auth/check_credentials', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });

    if (!user) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    // Check for ban status
    if (user.is_banned && user.banned_until && new Date() < user.banned_until) {
        const timeLeft = user.banned_until.getTime() - new Date().getTime();
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return res.status(403).json({ message: `Tu cuenta está suspendida. Tiempo restante: ${days}d ${hours}h.` });
    }

    if (user.password_hash && await bcrypt.compare(password, user.password_hash)) {
        return res.status(200).json({ message: 'Credenciales válidas.' });
    } else {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }
});

// Step 2: Complete login with security code and issue JWT
router.post('/api/auth/login', async (req, res) => {
    const { username, password, security_code } = req.body;

    const user = await User.findOne({ where: { username } });

    if (!user) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    // Check for ban status (redundant if check_credentials is always called first, but good for safety)
    if (user.is_banned && user.banned_until && new Date() < user.banned_until) {
        const timeLeft = user.banned_until.getTime() - new Date().getTime();
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return res.status(403).json({ message: `Tu cuenta está suspendida. Tiempo restante: ${days}d ${hours}h.` });
    }

    if (user.password_hash && await bcrypt.compare(password, user.password_hash)) {
        if (user.security_code === security_code) {
            const token = jwt.sign(
                { user_id: user.id, username: user.username },
                process.env.SECRET_KEY,
                { algorithm: 'HS256' }
            );
            return res.status(200).json({ message: 'Inicio de sesión exitoso.', token });
        } else {
            return res.status(401).json({ message: 'Código de seguridad incorrecto.' });
        }
    } else {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }
});

// Register a new user
router.post('/register', async (req, res) => {
    const { username, password, security_code } = req.body;

    if (!username || !password || !security_code) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos.' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
        return res.status(409).json({ success: false, message: 'El nombre de usuario ya existe.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
        username,
        password_hash: hashedPassword,
        security_code,
    });

    return res.status(201).json({ success: true, message: '¡Registro exitoso! Ahora puedes iniciar sesión.' });
});

// Complete social registration (for users who logged in via OAuth for the first time)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const avatarsDir = path.join(__dirname, '..', 'static', 'images', 'avatars');
        fs.mkdirSync(avatarsDir, { recursive: true });
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/api/auth/complete_registration', upload.single('profile_picture'), async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token de sesión social no proporcionado.' });
    }

    const tempToken = authHeader.split(' ')[1]; // Applied the suggested edit here

    try {
        const data = jwt.verify(tempToken, process.env.SECRET_KEY);
        const social_id = data.social_id;
        const user_id = data.user_id; // Get the user_id from the temporary token

        const user = await User.findByPk(user_id); // Find the user by ID

        if (!user || user.social_id !== social_id) {
            return res.status(404).json({ message: 'Usuario no encontrado o sesión inválida.' });
        }

        const { username, password, phone_number } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
        }

        // Validate username uniqueness for other users
        const existingUsernameUser = await User.findOne({ where: { username, id: { [require('sequelize').Op.ne]: user.id } } });
        if (existingUsernameUser) {
            return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
        }

        user.username = username;
        user.password_hash = await bcrypt.hash(password, 10);
        user.phone_number = phone_number || user.phone_number;

        if (req.file) {
            user.avatar_url = `/images/avatars/${req.file.filename}`;
        }

        await user.save();

        const finalToken = jwt.sign({
            user_id: user.id,
            username: user.username
        },
            process.env.SECRET_KEY,
            { algorithm: 'HS256' }
        );
        return res.status(200).json({ message: '¡Registro completado con éxito!', token: finalToken });

    } catch (error) {
        console.error('Error completing social registration:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Tu sesión de registro ha expirado. Por favor, vuelve a iniciar sesión.' });
        }
        return res.status(401).json({ message: 'Token inválido.' });
    }
});

// --- OAuth Routes ---
router.get('/login/google', passport.authenticate('google', { session: false }));

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: FRONTEND_LOGIN_URL, session: false }),
    (req, res) => {
        // If it's a new user and they need to complete registration
        if (!req.user.password_hash) { // Check if a password_hash exists as a proxy for completed registration
            const tempToken = jwt.sign(
                { social_id: req.user.social_id, user_id: req.user.id, username: req.user.username, avatar_url: req.user.avatar_url },
                process.env.SECRET_KEY,
                { algorithm: 'HS256', expiresIn: '1h' } // Temporary token valid for 1 hour
            );
            return res.redirect(`${FRONTEND_REDIRECT_URL}?temp_token=${tempToken}`);
        }

        // Existing user, generate full JWT
        const token = jwt.sign(
            { user_id: req.user.id, username: req.user.username },
            process.env.SECRET_KEY,
            { algorithm: 'HS256' }
        );
        res.redirect(`${FRONTEND_REDIRECT_URL}?token=${token}`);
    }
);

router.get('/login/microsoft', passport.authenticate('microsoft', { session: false }));

router.get('/auth/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: FRONTEND_LOGIN_URL, session: false }),
    (req, res) => {
        if (!req.user.password_hash) {
            const tempToken = jwt.sign(
                { social_id: req.user.social_id, user_id: req.user.id, username: req.user.username, avatar_url: req.user.avatar_url },
                process.env.SECRET_KEY,
                { algorithm: 'HS256', expiresIn: '1h' } // Temporary token valid for 1 hour
            );
            return res.redirect(`${FRONTEND_REDIRECT_URL}?temp_token=${tempToken}`);
        }

        const token = jwt.sign(
            { user_id: req.user.id, username: req.user.username },
            process.env.SECRET_KEY,
            { algorithm: 'HS256' }
        );
        res.redirect(`${FRONTEND_REDIRECT_URL}?token=${token}`);
    }
);

// Logout is typically handled on the frontend by clearing the token.
// If a backend logout is needed (e.g., for session invalidation), it would go here.
router.get('/logout', (req, res) => {
    // For JWTs, logout is mainly a client-side action (deleting the token).
    // If sessions were used, req.logout() and req.session.destroy() would be here.
    res.redirect('/'); // Redirect to home or login page
});

module.exports = router;

