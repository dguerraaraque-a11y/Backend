const express = require('express');
const { Op } = require('sequelize');
const { verifyToken, publicEndpoint } = require('../auth/middleware');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { update_user_role } = require('../utils/helpers');
const { pusher } = require('../server'); // Import pusher instance

const router = express.Router();

// Get chat messages with pagination and filtering
router.get('/api/chat_messages', publicEndpoint, async (req, res) => {
    const sinceTimestampStr = req.query.since;
    let messages = [];

    try {
        if (sinceTimestampStr) {
            const sinceTimestamp = new Date(sinceTimestampStr);
            if (isNaN(sinceTimestamp.getTime())) {
                return res.status(400).json({ error: "Formato de fecha inválido" });
            }
            messages = await ChatMessage.findAll({
                where: { timestamp: { [Op.gt]: sinceTimestamp } },
                order: [['timestamp', 'ASC']],
            });
        } else {
            // If no 'since', get the latest 50 messages
            messages = await ChatMessage.findAll({
                order: [['timestamp', 'DESC']],
                limit: 50,
            });
            messages.reverse(); // Reverse to get chronological order
        }

        if (messages.length === 0) {
            // If no messages in DB, return bot messages for testing
            const now = new Date();
            const botMessages = [
                {
                    id: -1, username: 'GLauncher-Bot', content: '¡Hola! Soy el bot de GLauncher. Este es un chat de prueba para que veas cómo funciona. 🔥',
                    type: 'text', timestamp: new Date(now.getTime() - (5 * 60 * 1000)).toISOString(),
                    role: 'Pico de Netherite', username_color: '#ff00ff'
                },
                {
                    id: -2, username: 'DJ-TROPIRUMBA', content: '¡Saludos a todos los que sintonizan Tropirumba Stereo! 🎶 ¿Listos para la mejor música?',
                    type: 'text', timestamp: new Date(now.getTime() - (3 * 60 * 1000)).toISOString(),
                    role: 'Pico de Diamante', username_color: '#00ffff'
                },
                {
                    id: -3, username: 'Usuario-Test', content: '¡Esto se ve genial! Probando el historial de chat. 🚀',
                    type: 'text', timestamp: new Date(now.getTime() - (1 * 60 * 1000)).toISOString(),
                    role: 'Pico de madera', username_color: '#ffffff'
                }
            ];
            return res.json(botMessages);
        } else {
            return res.json(messages.map(msg => ({
                id: msg.id, username: msg.username, content: msg.content,
                type: msg.message_type, timestamp: msg.timestamp.toISOString(),
                role: msg.role, username_color: msg.username_color
            })));
        }
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Create a new chat message
router.post('/api/chat_messages/create', async (req, res) => {
    const { content, username: guestUsername, type = 'text', color } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    }

    let user = null;
    let username = guestUsername || 'Invitado';
    let role = 'Invitado';
    let username_color = color;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const tokenData = jwt.verify(token, process.env.SECRET_KEY);
            user = await User.findByPk(tokenData.user_id);
            if (user) {
                await update_user_role(user);
                username = user.username;
                role = user.role;

                const now = new Date();
                if (user.last_message_time && (now.getTime() - user.last_message_time.getTime()) < 3000) { // 3 seconds limit
                    return res.status(429).json({ error: 'Estás enviando mensajes demasiado rápido.' });
                }
                user.last_message_time = now;
                await user.save();
            }
        } catch (error) {
            console.warn('Invalid or expired token for chat message creation:', error.message);
            // Continue as guest if token is invalid/expired
        }
    }

    const newChatMessage = await ChatMessage.create({
        user_id: user ? user.id : null,
        username: username,
        role: role,
        username_color: username_color,
        content: content,
        message_type: type,
    });

    try {
        pusher.trigger('presence-chat_radio', 'new_message', {
            id: newChatMessage.id, username: newChatMessage.username, content: newChatMessage.content,
            type: newChatMessage.message_type, timestamp: newChatMessage.timestamp.toISOString(),
            role: newChatMessage.role, username_color: newChatMessage.username_color
        });
    } catch (e) {
        console.error(`Error al enviar mensaje por Pusher: ${e}`);
    }

    res.status(201).json({
        id: newChatMessage.id, username: newChatMessage.username, content: newChatMessage.content,
        type: newChatMessage.message_type, timestamp: newChatMessage.timestamp.toISOString(),
        role: newChatMessage.role, username_color: newChatMessage.username_color
    });
});

// Delete a single chat message (Admin only)
router.delete('/api/chat_messages/:message_id', adminRequired, async (req, res) => {
    try {
        const { message_id } = req.params;
        const message = await ChatMessage.findByPk(message_id);

        if (!message) {
            return res.status(404).json({ message: 'Mensaje no encontrado.' });
        }

        await message.destroy();
        res.status(200).json({ message: 'Mensaje eliminado con éxito.' });
    } catch (error) {
        console.error('Error deleting chat message:', error);
        res.status(500).json({ message: `Error al eliminar el mensaje: ${error.message}` });
    }
});

// Delete all chat messages (Admin only)
router.delete('/api/chat_messages/all', adminRequired, async (req, res) => {
    try {
        await ChatMessage.destroy({ truncate: true }); // Truncate table for full clear
        res.status(200).json({ message: 'Todos los mensajes han sido eliminados.' });
    } catch (error) {
        console.error('Error clearing all chat messages:', error);
        res.status(500).json({ message: `Error al limpiar el chat: ${error.message}` });
    }
});

module.exports = router;
