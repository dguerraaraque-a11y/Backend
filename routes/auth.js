const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../glauncher_backend/models/User');
const { URL } = require('url');

const router = express.Router();

// --- CONFIGURACIÓN --- //

// URL a la que el frontend redirige al usuario para iniciar el login social.
// El frontend puede pasar opcionalmente ?successRedirect=... y ?failureRedirect=...
const FRONTEND_LOGIN_PAGE = process.env.FRONTEND_LOGIN_PAGE || 'https://glauncher-web.vercel.app/login.html';

// URL a la que el backend redirigirá al usuario DESPUÉS de un login social exitoso.
// Esta página se encarga de recibir el token y pasarlo a la aplicación principal.
const FRONTEND_REDIRECT_HANDLER = process.env.FRONTEND_REDIRECT_HANDLER || 'https://glauncher-web.vercel.app/redirect.html';

// URL base de tu API de backend. Es crucial para que los callbacks de OAuth funcionen.
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://glauncher-api.onrender.com';


// --- HELPERS --- //

/**
 * Busca un usuario por su perfil social o crea uno nuevo si no existe.
 * Actualiza datos como el avatar en cada inicio de sesión.
 * @param {object} profile - El perfil de usuario devuelto por Passport (de Google o Microsoft).
 * @param {string} provider - El nombre del proveedor ('google' or 'microsoft').
 * @returns {Promise<User>} El registro del usuario de la base de datos.
 */
async function findOrCreateSocialUser(profile, provider) {
    const socialId = profile.id;

    // 1. Buscar al usuario por su ID social.
    let user = await User.findOne({ where: { social_id: socialId, provider } });

    const avatarUrl = (provider === 'google' && profile.photos && profile.photos[0]) ? profile.photos[0].value : null;

    if (user) {
        // 2. Si el usuario existe, actualizamos su avatar (si ha cambiado) y lo devolvemos.
        user.avatar_url = avatarUrl || user.avatar_url;
        await user.save();
        return user;
    } else {
        // 3. Si el usuario no existe, creamos uno nuevo.
        let username = profile.displayName || (profile.emails && profile.emails[0] && profile.emails[0].value.split('@')[0]) || `user${profile.id}`;

        // 4. Verificamos si el nombre de usuario sugerido ya está en uso.
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            // Si ya existe, añadimos un sufijo aleatorio para hacerlo único.
            username = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // 5. Creamos el nuevo usuario en la base de datos.
        return await User.create({
            username,
            provider,
            social_id: socialId,
            avatar_url: avatarUrl,
        });
    }
}


// --- RUTAS DE AUTENTICACIÓN LOCAL (GLauncher Account) --- //

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


// --- CONFIGURACIÓN DE PASSPORT.JS PARA LOGIN SOCIAL --- //

if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_API_URL}/auth/google/callback`, // URL absoluta es clave
        scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateSocialUser(profile, 'google');
            done(null, user); // El usuario se adjuntará a req.user
        } catch (error) {
            done(error, null);
        }
    }));
}

if (process.env.MICROSOFT_CLIENT_ID) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${BACKEND_API_URL}/auth/microsoft/callback`, // URL absoluta es clave
        scope: ['user.read'],
        tenant: 'common',
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateSocialUser(profile, 'microsoft');
            done(null, user); // El usuario se adjuntará a req.user
        } catch (error) {
            done(error, null);
        }
    }));
}

// Estos son necesarios para que Passport maneje los datos del usuario, aunque no usemos sesiones
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// --- RUTAS DE LOGIN SOCIAL --- //

// Ruta de inicio para Google
router.get('/login/google', passport.authenticate('google', { session: false }));

// Callback de Google: se ejecuta después de que el usuario autoriza en la página de Google
router.get('/auth/google/callback',
    passport.authenticate('google', {
        session: false,
        // En caso de fallo, redirige al usuario a la página de login con un error.
        failureRedirect: `${FRONTEND_LOGIN_PAGE}?error=google_failed`
    }),
    (req, res) => {
        // Si la autenticación fue exitosa, req.user contiene los datos del usuario.
        const token = jwt.sign({ user_id: req.user.id, username: req.user.username }, process.env.SECRET_KEY, { algorithm: 'HS256' });

        // Redirige al handler del frontend, pasando el token y el username como parámetros.
        const redirectUrl = new URL(FRONTEND_REDIRECT_HANDLER);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('username', req.user.username);
        res.redirect(redirectUrl.toString());
    }
);

// Ruta de inicio para Microsoft
router.get('/login/microsoft', passport.authenticate('microsoft', { session: false }));

// Callback de Microsoft
router.get('/auth/microsoft/callback',
    passport.authenticate('microsoft', {
        session: false,
        failureRedirect: `${FRONTEND_LOGIN_PAGE}?error=microsoft_failed`
    }),
    (req, res) => {
        const token = jwt.sign({ user_id: req.user.id, username: req.user.username }, process.env.SECRET_KEY, { algorithm: 'HS256' });

        const redirectUrl = new URL(FRONTEND_REDIRECT_HANDLER);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('username', req.user.username);
        res.redirect(redirectUrl.toString());
    }
);


module.exports = router;
