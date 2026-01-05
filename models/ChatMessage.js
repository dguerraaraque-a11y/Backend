const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ChatMessage = sequelize.define('ChatMessage', {
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
        allowNull: true,
    },
    username: {
        type: DataTypes.STRING(80),
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING(50),
        defaultValue: 'Invitado',
        allowNull: false,
    },
    username_color: {
        type: DataTypes.STRING(7),
        allowNull: true,
    },
    content: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    message_type: {
        type: DataTypes.STRING(10),
        defaultValue: 'text',
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'chat_messages',
    timestamps: false,
});

ChatMessage.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(ChatMessage, { foreignKey: 'user_id' });

module.exports = ChatMessage;
