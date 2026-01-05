const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CosmeticItem = sequelize.define('CosmeticItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    rarity: {
        type: DataTypes.STRING(50),
        defaultValue: 'common',
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    image_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    model_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    tableName: 'cosmetic_items',
    timestamps: false,
});

module.exports = CosmeticItem;
