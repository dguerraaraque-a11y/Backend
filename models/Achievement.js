const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Achievement = sequelize.define('Achievement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    icon: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    rarity: {
        type: DataTypes.STRING(50),
        defaultValue: 'common',
        allowNull: false,
    },
}, {
    tableName: 'achievements',
    timestamps: false,
});

module.exports = Achievement;
