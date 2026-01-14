const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING(80),
        unique: true,
        allowNull: false,
    },
    password_hash: {
        type: DataTypes.STRING(120),
        allowNull: true, // Can be null for social logins
    },
    security_code: {
        type: DataTypes.STRING(6),
        allowNull: true,
    },
    provider: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    social_id: {
        type: DataTypes.STRING(200),
        unique: true,
        allowNull: true,
    },
    avatar_url: {
        type: DataTypes.STRING(512),
        allowNull: true,
    },
    registration_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING(50),
        defaultValue: 'Pico de madera',
        allowNull: false,
    },
    is_admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    gcoins: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Disponible',
        allowNull: false,
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    is_banned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    banned_until: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    ban_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    last_message_time: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    last_typing_time: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    last_daily_reward_claim: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    play_time_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    friends_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    followers_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    following_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
}, {
    tableName: 'users', // Explicitly define table name
    timestamps: false, // Disable createdAt and updatedAt columns
});

module.exports = User;
