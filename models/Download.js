const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Download = sequelize.define('Download', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    platform: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    version: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    icon_class: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    file_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
}, {
    tableName: 'downloads',
    timestamps: false,
});

module.exports = Download;
