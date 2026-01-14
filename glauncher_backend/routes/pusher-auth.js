const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { pusher } = require('../server'); // Import pusher instance

const router = express.Router();

// Pusher Authentication Endpoint for Presence Channels
router.post("/pusher/auth", async (req, res) => {
    const authHeader = req.headers.authorization;
    let userData = {};

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // If no token, it's a guest
        userData = { user_id: `invitado_${Math.random().toString(36).substring(2, 10)}` };
    } else {
        const token = authHeader.split(" ")[1];
        try {
            // Validate token to get user data
            const data = jwt.verify(token, process.env.SECRET_KEY);
            const user = await User.findByPk(data.user_id);
            if (user) {
                userData = { user_id: user.id, user_info: { username: user.username, role: user.role, status: user.status } };
            } else { // Valid token but user not found
                userData = { user_id: `invitado_${Math.random().toString(36).substring(2, 10)}` };
            }
        } catch (error) {
            // If token is invalid/expired, it's also a guest (or forbidden, depending on exact requirements)
            return res.status(403).send("Forbidden: Invalid token");
        }
    }

    try {
        const auth = pusher.authenticate(
            req.body.channel_name, req.body.socket_id, {
                user_id: String(userData.user_id), // Pusher expects user_id to be a string
                user_info: userData.user_info || {}
            }
        );
        res.send(auth);
    } catch (e) {
        console.error("Pusher authentication error:", e);
        res.status(403).send(`Error de autenticación de Pusher: ${e.message}`);
    }
});

module.exports = router;
