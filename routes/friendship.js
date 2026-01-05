const express = require('express');
const { Op } = require('sequelize');
const { verifyToken } = require('../auth/middleware');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const router = express.Router();

// Get friends, pending requests, and sent requests
router.get('/api/friends', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;

        // Accepted friends
        const acceptedFriends = await Friendship.findAll({
            where: {
                [Op.or]: [
                    { user_id: userId, status: 'accepted' },
                    { friend_id: userId, status: 'accepted' },
                ],
            },
            include: [
                {
                    model: User,
                    as: 'Requester',
                    attributes: ['id', 'username', 'avatar_url', 'role', 'status', 'last_typing_time'],
                },
                {
                    model: User,
                    as: 'Addressee',
                    attributes: ['id', 'username', 'avatar_url', 'role', 'status', 'last_typing_time'],
                },
            ],
        });

        const friendsList = new Set();
        acceptedFriends.forEach(f => {
            if (f.Requester.id === userId) {
                friendsList.add(JSON.stringify({
                    id: f.Addressee.id,
                    username: f.Addressee.username,
                    avatar_url: f.Addressee.avatar_url,
                    role: f.Addressee.role,
                    status: f.Addressee.status,
                    last_typing_time: f.Addressee.last_typing_time ? f.Addressee.last_typing_time.toISOString() : null
                }));
            } else {
                friendsList.add(JSON.stringify({
                    id: f.Requester.id,
                    username: f.Requester.username,
                    avatar_url: f.Requester.avatar_url,
                    role: f.Requester.role,
                    status: f.Requester.status,
                    last_typing_time: f.Requester.last_typing_time ? f.Requester.last_typing_time.toISOString() : null
                }));
            }
        });

        // Pending requests (others sent to me)
        const pendingRequests = await Friendship.findAll({
            where: {
                friend_id: userId,
                status: 'pending',
            },
            include: [
                {
                    model: User,
                    as: 'Requester',
                    attributes: ['id', 'username', 'avatar_url', 'role', 'status'],
                },
            ],
        });

        const pending = pendingRequests.map(f => ({
            id: f.Requester.id,
            username: f.Requester.username,
            avatar_url: f.Requester.avatar_url,
            role: f.Requester.role,
            status: f.Requester.status,
        }));

        // Sent requests (I sent to others)
        const sentRequests = await Friendship.findAll({
            where: {
                user_id: userId,
                status: 'pending',
            },
            include: [
                {
                    model: User,
                    as: 'Addressee',
                    attributes: ['id', 'username', 'avatar_url', 'role', 'status'],
                },
            ],
        });

        const sent = sentRequests.map(f => ({
            id: f.Addressee.id,
            username: f.Addressee.username,
            avatar_url: f.Addressee.avatar_url,
            role: f.Addressee.role,
            status: f.Addressee.status,
        }));

        res.json({
            friends: Array.from(friendsList).map(JSON.parse),
            pending: pending,
            sent: sent,
        });

    } catch (error) {
        console.error('Error fetching friends:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Add a friend
router.post('/api/friends/add', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { username: friendUsername } = req.body;

        if (!friendUsername) {
            return res.status(400).json({ message: 'Nombre de usuario no proporcionado.' });
        }

        const friend = await User.findOne({ where: { username: friendUsername } });

        if (!friend) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (friend.id === userId) {
            return res.status(400).json({ message: 'No puedes agregarte a ti mismo.' });
        }

        // Check for existing friendship or pending request in either direction
        const existingFriendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: friend.id },
                    { user_id: friend.id, friend_id: userId },
                ],
            },
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(409).json({ message: 'Ya eres amigo de este usuario.' });
            } else {
                return res.status(409).json({ message: 'Ya existe una solicitud de amistad pendiente.' });
            }
        }

        await Friendship.create({ user_id: userId, friend_id: friend.id, status: 'pending' });

        res.status(201).json({ message: `Solicitud de amistad enviada a ${friend.username}.` });

    } catch (error) {
        console.error('Error adding friend:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Accept a friend request
router.post('/api/friends/accept', verifyToken, async (req, res) => {
    try {
        const userId = req.userId; // The user accepting the request
        const { friend_id: senderId } = req.body; // The user who sent the request

        const friendship = await Friendship.findOne({
            where: { user_id: senderId, friend_id: userId, status: 'pending' },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Solicitud de amistad no encontrada.' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.status(200).json({ message: 'Solicitud de amistad aceptada.' });

    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Remove a friend or decline a request
router.post('/api/friends/remove', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { friend_id: targetFriendId } = req.body;

        const friendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: targetFriendId },
                    { user_id: targetFriendId, friend_id: userId },
                ],
            },
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Relación de amistad no encontrada.' });
        }

        await friendship.destroy();

        res.status(200).json({ message: 'Amigo eliminado/solicitud rechazada correctamente.' });

    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
