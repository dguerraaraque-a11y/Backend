const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const News = sequelize.define('News', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    date: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    image: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    link: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    icon: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    buttonText: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
}, {
    tableName: 'news',
    timestamps: false,
});

module.exports = News;
