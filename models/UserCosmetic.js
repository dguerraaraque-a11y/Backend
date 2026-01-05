const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const CosmeticItem = require('./CosmeticItem');

const UserCosmetic = sequelize.define('UserCosmetic', {
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id',
        },
        primaryKey: true,
    },
    cosmetic_item_id: {
        type: DataTypes.INTEGER,
        references: {
            model: CosmeticItem,
            key: 'id',
        },
        primaryKey: true,
    },
}, {
    tableName: 'user_cosmetic',
    timestamps: false,
});

User.belongsToMany(CosmeticItem, { through: UserCosmetic, foreignKey: 'user_id', as: 'owned_cosmetics' });
CosmeticItem.belongsToMany(User, { through: UserCosmetic, foreignKey: 'cosmetic_item_id', as: 'owners' });

module.exports = UserCosmetic;
