// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const Pusher = require('pusher');
const sequelize = require('./config/database'); // Placeholder for database config

// Import all models to ensure they are registered with Sequelize
require('./models/User');
require('./models/Friendship');
require('./models/Achievement');
require('./models/UserAchievement');
require('./models/AchievementReaction');
require('./models/LaunchMessage');
require('./models/ChatMessage');
require('./models/PrivateMessage');
require('./models/News');
require('./models/Download');
require('./models/CosmeticItem');
require('./models/UserCosmetic'); // This is the join table, also needs to be required

const app = express();
const PORT = process.env.PORT || 3000;

// --- Passport.js Setup ---
const passport = require('passport');
app.use(passport.initialize());

// --- Pusher Configuration ---
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});

// --- Middleware ---
app.use(cors({ credentials: true, origin: 'https://glauncher.vercel.app' })); // Adjust origin for your frontend
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// --- Static Files Configuration ---
const currentDir = __dirname;
const staticDir = path.join(currentDir, 'static');
const modelsDir = path.join(staticDir, 'models');
const frontendDir = path.join(currentDir, '..', 'GLAUNCHER-WEB');

// Ensure directories exist
require('fs').mkdirSync(modelsDir, { recursive: true });
require('fs').mkdirSync(path.join(staticDir, 'data'), { recursive: true });
require('fs').mkdirSync(path.join(frontendDir, 'downloads'), { recursive: true });
require('fs').mkdirSync(path.join(frontendDir, 'uploads', 'chat'), { recursive: true });
require('fs').mkdirSync(path.join(staticDir, 'images', 'avatars'), { recursive: true });
require('fs').mkdirSync(path.join(staticDir, 'images', 'shop'), { recursive: true });

// app.use(express.static(frontendDir)); // Serve frontend static files
app.use('/static', express.static(staticDir)); // Serve backend static files (e.g., test_suite.html)
app.use('/images', express.static(path.join(staticDir, 'images')));
app.use('/models', express.static(modelsDir));
app.use('/downloads', express.static(path.join(frontendDir, 'downloads')));
app.use('/uploads/chat', express.static(path.join(frontendDir, 'uploads', 'chat')));

// --- Routes (will be defined in separate files) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(staticDir, 'test_suite.html'));
});

// Import authentication routes (must come after passport.initialize)
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const friendshipRoutes = require('./routes/friendship');
const newsRoutes = require('./routes/news'); // Import news routes
const downloadRoutes = require('./routes/downloads'); // Import downloads routes
const shopRoutes = require('./routes/shop'); // Import shop routes
const achievementRoutes = require('./routes/achievements'); // Import achievements routes
const adminRoutes = require('./routes/admin'); // Import admin routes
const gchatRoutes = require('./routes/gchat'); // Import gchat routes
const chatRoutes = require('./routes/chat');
const pusherAuthRoutes = require('./routes/pusher-auth');
const communityWallRoutes = require('./routes/communityWall'); // Import community wall routes

app.use(authRoutes);
app.use(userRoutes);
app.use(friendshipRoutes);
app.use(newsRoutes);
app.use(downloadRoutes);
app.use(shopRoutes);
app.use(achievementRoutes);
app.use(adminRoutes);
app.use(gchatRoutes);
app.use(chatRoutes);
app.use(pusherAuthRoutes);
app.use(communityWallRoutes); // Use the community wall routes
// --- Database Synchronization ---
sequelize.sync({ force: false })
    .then(() => {
        console.log('Database & tables created!');
        // The create_first_admin route is now in routes/admin.js and can be accessed directly if needed.
        // No direct call needed here, it's an API endpoint.
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

// Export pusher for use in other modules
module.exports = { app, pusher };

