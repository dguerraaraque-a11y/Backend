const express = require('express');
const { verifyToken } = require('../auth/middleware');
const UserAchievement = require('../models/UserAchievement');
const AchievementReaction = require('../models/AchievementReaction');
const { pusher } = require('../server'); // Import pusher instance

const router = express.Router();

// React to an achievement
router.post('/api/achievements/react', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { user_achievement_id, reaction_type = 'like' } = req.body;

        const userAchievement = await UserAchievement.findByPk(user_achievement_id);
        if (!userAchievement) {
            return res.status(404).json({ message: 'Logro de usuario no encontrado.' });
        }

        let existingReaction = await AchievementReaction.findOne({
            where: { user_id: userId, user_achievement_id: user_achievement_id },
        });

        if (existingReaction) {
            // If exists, delete it (toggle off)
            await existingReaction.destroy();
        } else {
            // If not exists, create it (toggle on)
            await AchievementReaction.create({
                user_id: userId,
                user_achievement_id: user_achievement_id,
                reaction_type: reaction_type,
            });
        }

        // Count reactions and notify clients
        const reactionCount = await AchievementReaction.count({
            where: { user_achievement_id: user_achievement_id },
        });

        pusher.trigger('dashboard', 'achievement-reaction-update', {
            user_achievement_id: user_achievement_id,
            count: reactionCount,
        });

        res.status(200).json({ message: 'Reacción actualizada.', new_count: reactionCount });
    } catch (error) {
        console.error('Error reacting to achievement:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
