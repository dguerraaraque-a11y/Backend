const express = require('express');
const { verifyToken } = require('../auth/middleware');
const User = require('../models/User');
const CosmeticItem = require('../models/CosmeticItem');
const UserCosmetic = require('../models/UserCosmetic');
const { Op } = require('sequelize');

const router = express.Router();

// Claim daily reward
router.post('/api/shop/claim_daily_reward', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const now = new Date();
        // Corrected variable name: removed space between twentyFour and HoursAgo
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        if (user.last_daily_reward_claim && user.last_daily_reward_claim > twentyFourHoursAgo) {
            return res.status(429).json({ message: 'Ya has reclamado tu recompensa diaria.' });
        }

        const rewardAmount = 50;
        user.gcoins += rewardAmount;
        user.last_daily_reward_claim = now;
        await user.save();

        res.status(200).json({ message: `¡Has reclamado ${rewardAmount} GCoins!`, new_balance: user.gcoins });
    } catch (error) {
        console.error('Error claiming daily reward:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Get all shop items
router.get('/api/shop/items', async (req, res) => {
    try {
        const items = await CosmeticItem.findAll({ where: { is_active: true } });
        res.json(items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            rarity: item.rarity,
            category: item.category,
            image_url: item.image_path, // Frontend will construct full URL
        })));
    } catch (error) {
        console.error('Error al obtener ítems de la tienda:', error);
        res.status(500).json({ error: 'No se pudieron cargar los artículos de la tienda.' });
    }
});

// Purchase an item
router.post('/api/shop/purchase', verifyToken, async (req, res) => {
    try {
        const { item_id } = req.body;

        const user = await User.findByPk(req.userId);
        const item = await CosmeticItem.findByPk(item_id);

        if (!user || !item) {
            return res.status(404).json({ message: 'Usuario o artículo no encontrado.' });
        }

        // Check if user already owns the item
        const ownsItem = await UserCosmetic.findOne({
            where: {
                user_id: user.id,
                cosmetic_item_id: item.id,
            },
        });

        if (ownsItem) {
            return res.status(409).json({ message: 'Ya posees este artículo.' });
        }

        if (user.gcoins < item.price) {
            return res.status(402).json({ message: 'No tienes suficientes GCoins.' });
        }

        user.gcoins -= item.price;
        await user.save();

        await UserCosmetic.create({
            user_id: user.id,
            cosmetic_item_id: item.id,
        });

        res.status(200).json({ message: `¡Has comprado "${item.name}" con éxito!`, new_balance: user.gcoins });
    } catch (error) {
        console.error('Error purchasing item:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;

