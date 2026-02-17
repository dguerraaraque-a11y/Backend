const express = require('express');
const { adminRequired, publicEndpoint } = require('../auth/middleware');
const { Op } = require('sequelize');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { update_user_role } = require('../utils/helpers');
const jwt = require('jsonwebtoken');
const pusher = require('../config/pusher'); // Importa la instancia de Pusher compartida

const router = express.Router();

// ==========================================
// 1. OBTENER MENSAJES (HISTORIAL)
// ==========================================

router.get('/api/chat_messages', publicEndpoint, async (req, res) => {
    const sinceTimestampStr = req.query.since;
    let messages = [];

    try {
        if (sinceTimestampStr) {
            const sinceTimestamp = new Date(sinceTimestampStr);
            if (isNaN(sinceTimestamp.getTime())) {
                return res.status(400).json({ error: "Formato de fecha inválido" });
            }
            // Buscar mensajes nuevos
            messages = await ChatMessage.findAll({
                where: { timestamp: { [Op.gt]: sinceTimestamp } },
                order: [['timestamp', 'ASC']],
            });
        } else {
            // Cargar últimos 50
            messages = await ChatMessage.findAll({
                order: [['timestamp', 'DESC']],
                limit: 50,
            });
            messages.reverse();
        }

        return res.json(messages.map(msg => ({
            id: msg.id,
            username: msg.username,
            content: msg.content,
            type: msg.message_type,
            timestamp: msg.timestamp.toISOString(),
            role: msg.role,
            username_color: msg.username_color
        })));

    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error interno al cargar el chat.' });
    }
});

// ==========================================
// 2. ENVIAR MENSAJE
// ==========================================

router.post('/api/chat_messages/create', async (req, res) => {
    const { content, username: guestUsername, type = 'text', color } = req.body;

    if (!content || content.trim() === "") {
        return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    let user = null;
    let username = guestUsername || 'Invitado';
    let role = 'Invitado';
    let username_color = color || '#ffffff';
    let user_id = null;

    // Verificar Token JWT si existe
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const tokenData = jwt.verify(token, process.env.SECRET_KEY);
            user = await User.findByPk(tokenData.user_id);
            
            if (user) {
                // Verificar BAN
                if (user.is_banned && (user.banned_until === null || user.banned_until > new Date())) {
                    return res.status(403).json({ error: 'Tu cuenta está baneada.', reason: user.ban_reason });
                }

                await update_user_role(user);
                username = user.username;
                role = user.role;
                user_id = user.id;

                // Control de Spam (2 segundos)
                const now = new Date();
                if (user.last_message_time && (now.getTime() - user.last_message_time.getTime()) < 2000) {
                    return res.status(429).json({ error: 'Espera unos segundos antes de enviar otro mensaje.' });
                }
                user.last_message_time = now;
                await user.save();
            }
        } catch (error) {
            console.warn('Token inválido en chat, enviando como invitado.');
        }
    }

    try {
        const newChatMessage = await ChatMessage.create({
            user_id: user_id,
            username: username,
            role: role,
            username_color: username_color,
            content: content,
            message_type: type,
        });

        const messageData = {
            id: newChatMessage.id,
            username: newChatMessage.username,
            content: newChatMessage.content,
            type: newChatMessage.message_type,
            timestamp: newChatMessage.timestamp.toISOString(),
            role: newChatMessage.role,
            username_color: newChatMessage.username_color
        };

        // Enviar a Pusher
        pusher.trigger('presence-chat_radio', 'new_message', messageData);

        res.status(201).json(messageData);

    } catch (e) {
        console.error(`Error enviando mensaje: ${e}`);
        res.status(500).json({ error: 'No se pudo enviar el mensaje.' });
    }
});

// ==========================================
// 3. ELIMINAR MENSAJES (SOLO ADMIN)
// ==========================================

router.delete('/api/chat_messages/:message_id', adminRequired, async (req, res) => {
    try {
        const { message_id } = req.params;
        const message = await ChatMessage.findByPk(message_id);

        if (!message) {
            return res.status(404).json({ message: 'El mensaje no existe.' });
        }

        await message.destroy();

        // Avisar a todos que se borró el mensaje
        pusher.trigger('presence-chat_radio', 'delete_message', { id: message_id });

        res.status(200).json({ message: 'Mensaje eliminado.' });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar: ${error.message}` });
    }
});

// Borrar todo el historial
router.delete('/api/chat_messages/all', adminRequired, async (req, res) => {
    try {
        await ChatMessage.destroy({ truncate: true });
        
        pusher.trigger('presence-chat_radio', 'clear_chat', {});

        res.status(200).json({ message: 'Chat limpiado por completo.' });
    } catch (error) {
        res.status(500).json({ message: `Error al limpiar chat: ${error.message}` });
    }
});

module.exports = router;
