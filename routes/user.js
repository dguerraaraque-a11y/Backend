const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, adminRequired } = require('../auth/middleware');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { update_user_role } = require('../utils/helpers');
const { pusher } = require('../server'); // Import pusher instance

const router = express.Router();

// Multer storage for avatar uploads
const avatarStorage = multer.diskStorage({
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

const uploadAvatar = multer({ storage: avatarStorage });

// Get user information
router.get('/api/user_info', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            include: 'owned_cosmetics' // Include owned cosmetics if relationship is set up
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        await update_user_role(user); // Update role before sending info

        res.json({
            username: user.username,
            is_admin: user.is_admin,
            avatar_url: user.avatar_url,
            role: user.role,
            gcoins: user.gcoins,
            status: user.status,
            owned_cosmetics: user.owned_cosmetics ? user.owned_cosmetics.map(item => item.id) : [],
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Update user profile
router.post('/api/user/update_profile', verifyToken, uploadAvatar.single('avatar_file'), async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const { username, password, password_confirm } = req.body;

        // Update username
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ where: { username } });
            if (existingUser) {
                return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
            }
            user.username = username;
        }

        // Update password
        if (password) {
            if (password !== password_confirm) {
                return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
            }
            user.password_hash = await bcrypt.hash(password, 10);
        }

        // Update avatar
        if (req.file) {
            user.avatar_url = `/images/avatars/${req.file.filename}`;
        }

        await user.save();

        res.status(200).json({ message: 'Perfil actualizado con éxito. Los cambios se reflejarán la próxima vez que inicies sesión.' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: `Ocurrió un error: ${error.message}` });
    }
});

// Update user status
router.post('/api/user/status', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const { status } = req.body;
        const allowedStatuses = ['Disponible', 'Ausente', 'Jugando'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Estado no válido.' });
        }

        user.status = status;
        await user.save();

        // Notify via Pusher
        pusher.trigger(
            'presence-glauncher-users', 'status-update',
            { user_id: user.id, status: user.status }
        );

        res.status(200).json({ message: `Estado actualizado a "${status}".` });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
