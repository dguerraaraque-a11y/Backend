const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { verifyToken } = require('../auth/middleware');
const PrivateMessage = require('../models/PrivateMessage');
const User = require('../models/User');
const pusher = require('../config/pusher'); // Importa la instancia de Pusher compartida

const router = express.Router();

const CHAT_UPLOADS_DIR = path.join(__dirname, '..', '..', 'GLAUNCHER-WEB', 'uploads', 'chat');
fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });

// Multer storage for chat attachments
const chatAttachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CHAT_UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadChatAttachment = multer({ storage: chatAttachmentStorage });

// Get private chat history between two users
router.get('/api/gchat/history/:friend_id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const friendId = req.params.friend_id;

        const messages = await PrivateMessage.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId, recipient_id: friendId },
                    { sender_id: friendId, recipient_id: userId },
                ],
            },
            order: [['timestamp', 'ASC']],
        });

        res.json(messages.map(msg => ({
            id: msg.id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            type: msg.message_type,
            is_read: msg.is_read,
        })));
    } catch (error) {
        console.error('Error fetching GChat history:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Send a private message
router.post('/api/gchat/send/:recipient_id', verifyToken, async (req, res) => {
    try {
        const senderId = req.userId;
        const recipientId = req.params.recipient_id;
        const { content, type = 'text' } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
        }

        const msg = await PrivateMessage.create({
            sender_id: senderId,
            recipient_id: recipientId,
            content,
            message_type: type,
        });

        // Notify recipient via Pusher
        const channelName = `private-chat-${Math.min(senderId, recipientId)}-${Math.max(senderId, recipientId)}`;
        pusher.trigger(channelName, 'new_message', {
            id: msg.id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            type: msg.message_type,
        });

        res.status(201).json({
            id: msg.id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            type: msg.message_type,
        });
    } catch (error) {
        console.error('Error sending private message:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// GChat typing event
router.post('/api/gchat/typing', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (user) {
            user.last_typing_time = new Date();
            await user.save();
            return res.status(200).json({ status: 'ok' });
        }
        res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (error) {
        console.error('Error updating typing status:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Upload attachment for GChat
router.post('/api/gchat/upload_attachment', verifyToken, uploadChatAttachment.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se encontró el archivo.' });
        }

        const filename = req.file.filename;
        const mimeType = mime.lookup(filename);
        let messageType = 'file';

        if (mimeType) {
            if (mimeType.startsWith('image/')) messageType = 'image';
            else if (mimeType.startsWith('video/')) messageType = 'video';
            else if (mimeType.startsWith('audio/')) messageType = 'audio';
        }

        res.status(200).json({ url: `/uploads/chat/${filename}`, type: messageType });

    } catch (error) {
        console.error('Error uploading chat attachment:', error);
        // Clean up uploaded file if an error occurred
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: `Error al subir el archivo: ${error.message}` });
    }
});

module.exports = router;
