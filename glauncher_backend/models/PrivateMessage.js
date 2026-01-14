const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const PrivateMessage = sequelize.define('PrivateMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    sender_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id',
        },
        allowNull: false,
    },
    recipient_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id',
        },
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
    },
    message_type: {
        type: DataTypes.STRING(10),
        defaultValue: 'text',
        allowNull: false,
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
}, {
    tableName: 'private_messages',
    timestamps: false,
});

PrivateMessage.belongsTo(User, { as: 'Sender', foreignKey: 'sender_id' });
PrivateMessage.belongsTo(User, { as: 'Recipient', foreignKey: 'recipient_id' });
User.hasMany(PrivateMessage, { as: 'SentMessages', foreignKey: 'sender_id' });
User.hasMany(PrivateMessage, { as: 'ReceivedMessages', foreignKey: 'recipient_id' });

module.exports = PrivateMessage;
