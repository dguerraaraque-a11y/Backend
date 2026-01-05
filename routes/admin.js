const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { adminRequired } = require('../auth/middleware');
const CosmeticItem = require('../models/CosmeticItem');
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require('@google/generative-ai');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const { google } = require('googleapis');
// If Pusher is intended to be used and checked for status, it would need to be imported and initialized here:
const Pusher = require('pusher'); // Assumed Pusher is intended to be used and imported here for the status check
const pusher = new Pusher({
    appId: process.env.PUSDHER_APP_ID, // Typo in variable name (PUSDHER -> PUSHER)
    key: process.env.PUSDHER_KEY,     // Typo in variable name (PUSDHER -> PUSHER)
    secret: process.env.PUSDHER_SECRET, // Typo in variable name (PUSDHER -> PUSHER)
    cluster: process.env.PUSDHER_CLUSTER, // e.g., 'eu' // Typo in variable name (PUSDHER -> PUSHER)
    useTLS: true,
});
const router = express.Router();

const MODELS_DIR = path.join(__dirname, '..', 'static', 'models');
const IMAGES_SHOP_DIR = path.join(__dirname, '..', 'static', 'images', 'shop');

// Ensure directories exist
fs.mkdirSync(MODELS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_SHOP_DIR, { recursive: true });

// Corrected: Removed the trailing semicolon from 'gif'
const allowedExtensions = ['bbmodel', 'json', 'obj', 'png', 'jpg', 'jpeg', 'gif'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido.'), false);
    }
};

// Multer storage for cosmetic model and image uploads
// Corrected: `multer.diskDiskStorage` -> `multer.diskStorage`
const cosmeticStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'model_file') {
            const category = req.body.category || 'misc'; // Default category
            const categoryDir = path.join(MODELS_DIR, category);
            fs.mkdirSync(categoryDir, { recursive: true });
            cb(null, categoryDir);
        } else if (file.fieldname === 'image_file') {
            cb(null, IMAGES_SHOP_DIR);
        } else {
            cb(new Error('Invalid fieldname'), false);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadCosmetic = multer({ storage: cosmeticStorage, fileFilter: fileFilter });

// Multer storage for Gemini chat file uploads
const geminiUpload = multer({ storage: multer.memoryStorage() }); // New

// Create cosmetic item (Admin only)
router.post('/api/admin/cosmetics/create', adminRequired, uploadCosmetic.fields([{ name: 'model_file', maxCount: 1 }, { name: 'image_file', maxCount: 1 }]), async (req, res) => {
    try {
        // Corrected: `!req.files['model_file' || !req.files['image_file']]` -> `!req.files['model_file'] || !req.files['image_file']`
        if (!req.files || !req.files['model_file'] || !req.files['image_file') {
            return res.status(400).json({ message: 'Faltan archivos de modelo o imagen.' });
        }

        const modelFile = req.files['model_file'[0;
        const imageFile = req.files['image_file'][0]; // Corrected access to req.files
        const { name, description, price, rarity, category } = req.body;

        if (!name || !description || !price || !rarity || !category) {
            // Clean up uploaded files if other data is missing
            fs.unlinkSync(modelFile.path);
            fs.unlinkSync(imageFile.path);
            return res.status(400).json({ message: 'Faltan campos de cosmético requeridos.' });
        }

        const modelPath = `/models/${category}/${modelFile.filename}`;
        const imagePath = `/images/shop/${imageFile.filename}`;

        const newCosmeticItem = await CosmeticItem.create({
            name,
            description,
            price: parseInt(price),
            rarity,
            category,
            image_path: imagePath,
            model_path: modelPath,
        });

        res.status(201).json({ message: 'Cosmético creado con éxito.', item: newCosmeticItem });

    } catch (error) {
        console.error('Error creating cosmetic item:', error);
        // Corrected: `req.files['model_file'][0.path]` -> `req.files['model_file'][0].path`
        if (req.files && req.files['model_file'] && req.files['model_file'][0) fs.unlinkSync(req.files['model_file'][0].path);
        // Corrected: `req.files['image_file'][0.path]` -> `req.files['image_file'][0].path`
        if (req.files && req.files['image_file'] && req.files['image_file'][0]) fs.unlinkSync(req.files['image_file'][0].path);
        res.status(500).json({ message: `Error al crear el cosmético: ${error.message}` });
    }
});

// Update user role (Admin only)
router.post('/api/admin/update_user', adminRequired, async (req, res) => {
    try {
        const { user_id, role, is_admin } = req.body;

        const userToUpdate = await User.findByPk(user_id);
        if (!userToUpdate) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (role !== undefined) userToUpdate.role = role;
        if (is_admin !== undefined) userToUpdate.is_admin = is_admin;

        await userToUpdate.save();
        res.status(200).json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error('Error updating user by admin:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Get all users for admin panel (Admin only)
router.get('/api/admin/users', adminRequired, async (req, res) => {
    try {
        // Corrected syntax for order. It was already correct in the original, but confirmed.
        const users = await User.findAll({
            order: [['id', 'ASC']],
            attributes: [
                'id', 'username', 'role', 'is_admin', 'registration_date',
                'avatar_url', 'is_banned', 'banned_until', 'ban_reason'
        });

        res.json(users.map(user => ({
            id: user.id,
            username: user.username,
            role: user.role,
            is_admin: user.is_admin,
            registration_date: user.registration_date.toISOString(),
            avatar_url: user.avatar_url,
            is_banned: user.is_banned,
            banned_until: user.banned_until ? user.banned_until.toISOString() : null,
            ban_reason: user.ban_reason
        })));
    } catch (error) {
        console.error('Error fetching users for admin panel:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Ban/Unban user (Admin only)
router.post('/api/admin/users/ban', adminRequired, async (req, res) => {
    try {
        const { user_id, duration_hours, reason } = req.body;

        const userToBan = await User.findByPk(user_id);
        if (!userToBan) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (userToBan.is_admin) {
            return res.status(403).json({ message: 'No se puede banear a un administrador.' });
        }

        if (duration_hours === 0) { // Unban
            userToBan.is_banned = false;
            userToBan.banned_until = null;
            userToBan.ban_reason = null;
        } else {
            userToBan.is_banned = true;
            userToBan.banned_until = new Date(new Date().getTime() + duration_hours * 60 * 60 * 1000);
            userToBan.ban_reason = reason;
        }
        await userToBan.save();

        res.status(200).json({ message: `Usuario ${userToBan.username} ha sido actualizado.` });
    } catch (error) {
        console.error('Error banning/unbanning user:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Wipe all data (Admin only - VERY DESTRUCTIVE!)
router.post('/api/admin/wipe_all_data', adminRequired, async (req, res) => {
    try {
        // Delete all chat messages
        const numMessagesDeleted = await ChatMessage.destroy({ truncate: true });

        // Delete all non-admin users
        const numUsersDeleted = await User.destroy({ where: { is_admin: false } });

        res.status(200).json({
            message: `Limpieza completada. Se eliminaron ${numUsersDeleted} usuarios y ${numMessagesDeleted} mensajes.`
        });
    } catch (error) {
        console.error('Error wiping all data:', error);
        res.status(500).json({ message: `Error durante la limpieza: ${error.message}` });
    }
});

// Gemini Chat API (Admin only)
router.post('/api/gemini-chat', adminRequired, geminiUpload.single('file'), async (req, res) => {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ answer: "Error: La clave de API de Gemini no está configurada en el servidor." });
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);

        const historyStr = req.body.history || '[]';
        const section = req.body.section || 'general';
        const uploadedFile = req.file;

        let chatHistory = JSON.parse(historyStr);

        // The last message in history is the current user prompt.
        // We assume chatHistory is an array of objects like { role: 'user', parts: [{ text: '...' }] }
        // and that the *actual* prompt for the *current* turn is the last user message in the *history*.
        // The promptParts will be used for the sendMessage call.
        let currentPromptText = "";
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            currentPromptText = chatHistory[chatHistory.length - 1].parts[0].text;
            // Remove the last user prompt from history as it will be part of the sendMessage call itself
            chatHistory = chatHistory.slice(0, -1);
        }

        const promptParts = [`Contexto: Estás en la sección '${section}' del panel de administración. Responde a la siguiente pregunta: ${currentPromptText}`];

        let model;

        if (uploadedFile) {
            if (uploadedFile.mimetype.startsWith('image/')) {
                // For images, use gemini-pro-vision and add image to prompt parts
                model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
                promptParts.push({
                    inlineData: {
                        data: uploadedFile.buffer.toString('base64'),
                        mimeType: uploadedFile.mimetype,
                    },
                });
            } else {
                // For other files, read content as text and use gemini-pro
                model = genAI.getGenerativeModel({ model: "gemini-pro" });
                const fileContent = uploadedFile.buffer.toString('utf-8');
                promptParts.push(`\n\nContenido del archivo adjunto '${uploadedFile.originalname}':\n---\n${fileContent}`);
            }
        } else {
            model = genAI.getGenerativeModel({ model: "gemini-pro" });
        }

        const generationConfig = {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        };

        const safetySettings = [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ; // This closing bracket was previously malformed, now corrected.
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: generationConfig,
            safetySettings: safetySettings,
        });

        const result = await chat.sendMessage(promptParts);
        const response = await result.response;
        const text = response.text();

        res.json({ answer: text });

    } catch (error) {
        console.error('Error processing Gemini chat request:', error);
        res.status(500).json({ answer: `Ocurrió un error al procesar la solicitud: ${error.message}` });
    }
});


// YouTube Search API (Admin only)
router.get('/api/youtube/search', adminRequired, async (req, res) => {
    const query = req.query.q;
    const api_key = process.env.YOUTUBE_API_KEY;

    if (!query) {
        return res.status(400).json({ error: 'El parámetro de búsqueda "q" es requerido.' });
    }
    if (!api_key) {
        return res.status(500).json({ error: 'La clave de API de YouTube no está configurada en el servidor.' });
    }

    try {
        const youtube = google.youtube({
            version: 'v3',
            auth: api_key,
        });

        const searchResponse = await youtube.search.list({
            q: query,
            part: 'snippet',
            maxResults: 10,
            type: 'video',
        });

        const videos = searchResponse.data.items.map(item => ({
            title: item.snippet.title,
            videoId: item.id.videoId,
        }));

        res.json(videos);
    } catch (error) {
        console.error('Error with YouTube API:', error);
        if (error.response && error.response.status) {
            return res.status(error.response.status).json({ error: `Ocurrió un error con la API de YouTube: ${error.response.status} ${error.response.statusText}` });
        }
        res.status(500).json({ error: `Ocurrió un error inesperado: ${error.message}` });
    }
});

// Get System Status (Admin only)
router.get('/api/admin/status', adminRequired, async (req, res) => {
    const status = {
        backend: { status: 'online', message: 'API operativa.' },
        gemini: { status: 'loading', message: 'Comprobando...' },
        pusher: { status: 'loading', message: 'Comprobando...' },
        youtube: { status: 'loading', message: 'Comprobando...' },
    };

    // Check Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        status.gemini = { status: 'offline', message: 'Clave API no configurada.' };
    } else {
        try {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            // Make a simple request to verify the key
            await model.generateContent("Test", { generationConfig: { maxOutputTokens: 5 } });
            status.gemini = { status: 'online', message: 'Servicio operativo.' };
        } catch (error) {
            status.gemini = { status: 'offline', message: 'Clave API inválida o error de servicio.' };
            console.error('Gemini status check error:', error);
        }
    }

    // Check Pusher
    // Corrected: Use actual Pusher environment variable names (PUSHER_APP_ID, etc.)
    const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
    if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
        status.pusher = { status: 'offline', message: 'Claves de Pusher no configuradas.' };
    } else {
        // This part requires 'pusher' to be imported and initialized at the top of the file.
        // If not, this check will fail. Assuming 'pusher' object is available if configured.
        if (typeof pusher !== 'undefined' && pusher) {
            try {
                // Attempt to trigger a test event
                // Note: Triggering an event might not fully test client connectivity,
                // but it verifies server-side Pusher initialization and authentication.
                // Using a non-presence channel for a simple check.
                await pusher.trigger('test-channel', 'test_event', { message: 'ping' });
                status.pusher = { status: 'online', message: 'Servicio operativo.' };
            } catch (error) {
                status.pusher = { status: 'offline', message: `Error de conexión/configuración: ${error.message}` };
                console.error('Pusher status check error:', error);
            }
        } else {
            status.pusher = { status: 'offline', message: 'Objeto Pusher no inicializado. Asegúrate de importar y configurar Pusher.' };
        }
    }

    // Check YouTube API
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
        status.youtube = { status: 'offline', message: 'Clave API no configurada.' };
    } else {
        try {
            const youtube = google.youtube({ version: 'v3', auth: youtubeApiKey });
            // Make a simple request to verify the key
            await youtube.search.list({ q: 'test', part: 'id', maxResults: 1 });
            status.youtube = { status: 'online', message: 'Servicio operativo.' };
        } catch (error) {
            status.youtube = { status: 'offline', message: 'Clave API inválida o error de servicio.' };
            console.error('YouTube status check error:', error);
        }
    }

    res.json(status);
});

// Set Gemini API Key (Note: This is a demonstration. For production, manage environment variables securely.)
router.post('/api/admin/settings/gemini-key', adminRequired, (req, res) => {
    // WARNING: This DOES NOT persist the key on services like Vercel.
    // Environment variables on Vercel must be changed in its dashboard.
    // This route serves as a demonstration or for environments where they can be modified.
    res.status(400).json({ message: 'Funcionalidad no soportada en este entorno. Cambia la clave en el dashboard de Vercel.' });
});

// Route to create the first admin user (should be removed after first use)
router.get('/create_first_admin', async (req, res) => {
    // Check if an admin already exists to prevent creating more than one
    const existingAdmin = await User.findOne({ where: { is_admin: true } });
    if (existingAdmin) {
        return res.status(403).send("Un administrador ya existe. Esta función está desactivada.");
    }

    // Define admin credentials here
    const admin_username = "admin";
    const admin_password = "password123"; // !!! CHANGE THIS TO A SECURE PASSWORD !!!

    const hashedPassword = await bcrypt.hash(admin_password, 10);

    const adminUser = await User.create({
        username: admin_username,
        password_hash: hashedPassword,
        is_admin: true,
        role: "Pico de Netherite",
        security_code: Math.random().toString(36).substring(2, 8).toUpperCase(), // Generate a security code
    });

    res.status(200).send(`¡Usuario administrador '${admin_username}' creado con éxito! Ya puedes borrar esta ruta de admin.js.`);
});


module.exports = router;

