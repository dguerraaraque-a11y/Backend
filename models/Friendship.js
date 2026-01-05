const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Friendship = sequelize.define('Friendship', {
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
    friend_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id',
        },
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        allowNull: false,
    },
}, {
    tableName: 'friendships',
    timestamps: false,
    indexes: [
        {   // Enforce unique pairs regardless of order (user_id, friend_id) or (friend_id, user_id)
            unique: true,
            fields: ['user_id', 'friend_id'],
            where: { // This is a partial index to allow for pending requests to exist in one direction only
                status: 'accepted'
            }
        }
    ],
});

// Add a check constraint to ensure user_id is not equal to friend_id
// This is typically done at the database level, but Sequelize can add it too.
// For SQLite, this constraint needs to be added manually or via a migration script
// as Sequelize doesn't directly support `CHECK` constraints for `define`.
// For now, we'll rely on application-level validation.

User.hasMany(Friendship, { foreignKey: 'user_id', as: 'SentFriendRequests' });
User.hasMany(Friendship, { foreignKey: 'friend_id', as: 'ReceivedFriendRequests' });
Friendship.belongsTo(User, { foreignKey: 'user_id', as: 'Requester' });
Friendship.belongsTo(User, { foreignKey: 'friend_id', as: 'Addressee' });

module.exports = Friendship;
