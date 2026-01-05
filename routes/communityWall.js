const express = require('express');
const { publicEndpoint } = require('../auth/middleware');
const LaunchMessage = require('../models/LaunchMessage');
const { pusher } = require('../server'); // Import pusher instance

const router = express.Router();

// Get community wall messages with pagination
router.get('/api/launch_messages', publicEndpoint, async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: messages } = await LaunchMessage.findAndCountAll({
            order: [['timestamp', 'DESC']],
            limit: limit,
            offset: offset,
        });

        const hasMore = (offset + messages.length) < count;

        res.json({
            messages: messages.map(msg => ({
                id: msg.id,
                username: msg.username,
                content: msg.content,
                timestamp: msg.timestamp.toISOString(),
            })),
            has_more: hasMore,
        });
    } catch (error) {
        console.error('Error fetching launch messages:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Create a new community wall message
router.post('/api/launch_messages/create', publicEndpoint, async (req, res) => {
    const { username, content } = req.body;

    if (!username || !content) {
        return res.status(400).json({ message: 'El nombre y el contenido no pueden estar vacíos.' });
    }
    if (username.length > 25 || content.length > 200) {
        return res.status(400).json({ message: 'El nombre o el contenido exceden el límite de caracteres.' });
    }

    try {
        const newLaunchMessage = await LaunchMessage.create({
            username,
            content,
        });

        // Notify all clients via Pusher
        pusher.trigger('community_wall', 'new_message', {
            message: {
                id: newLaunchMessage.id,
                username: newLaunchMessage.username,
                content: newLaunchMessage.content,
                timestamp: newLaunchMessage.timestamp.toISOString(),
            }
        });

        res.status(201).json({ message: 'Mensaje publicado con éxito.', data: newLaunchMessage });
    } catch (error) {
        console.error('Error creating launch message:', error);
        res.status(500).json({ message: `Error al publicar el mensaje: ${error.message}` });
    }
});

module.exports = router;
