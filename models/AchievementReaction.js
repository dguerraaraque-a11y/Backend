const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const UserAchievement = require('./UserAchievement');

const AchievementReaction = sequelize.define('AchievementReaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id',
        },
        allowNull: false,
    },
    user_achievement_id: {
        type: DataTypes.INTEGER,
        references: {
            model: UserAchievement,
            key: 'id',
        },
        allowNull: false,
    },
    reaction_type: {
        type: DataTypes.STRING(50),
        defaultValue: 'like',
        allowNull: false,
    },
}, {
    tableName: 'achievement_reactions',
    timestamps: false,
});

AchievementReaction.belongsTo(User, { foreignKey: 'user_id' });
AchievementReaction.belongsTo(UserAchievement, { foreignKey: 'user_achievement_id' });
UserAchievement.hasMany(AchievementReaction, { foreignKey: 'user_achievement_id', onDelete: 'CASCADE' });

module.exports = AchievementReaction;
