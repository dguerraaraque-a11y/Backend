const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LaunchMessage = sequelize.define('LaunchMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING(80),
        allowNull: false,
    },
    content: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'launch_messages',
    timestamps: false, // Disable createdAt and updatedAt columns
});

module.exports = LaunchMessage;
