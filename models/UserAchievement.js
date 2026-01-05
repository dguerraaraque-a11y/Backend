const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Achievement = require('./Achievement');

const UserAchievement = sequelize.define('UserAchievement', {
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
    achievement_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Achievement,
            key: 'id',
        },
        allowNull: false,
    },
    unlocked_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'user_achievements',
    timestamps: false,
});

User.belongsToMany(Achievement, { through: UserAchievement, foreignKey: 'user_id' });
Achievement.belongsToMany(User, { through: UserAchievement, foreignKey: 'achievement_id' });

UserAchievement.belongsTo(User, { foreignKey: 'user_id' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievement_id' });

module.exports = UserAchievement;
