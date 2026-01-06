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
const Pusher = require('pusher');

/**
 * CONFIGURACIÓN DE PUSHER
 * Se inicializa aquí para evitar problemas de dependencia circular con server.js
 */
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
});

const router = express.Router();

// DEFINICIÓN DE RUTAS PARA ARCHIVOS ESTÁTICOS
const MODELS_DIR = path.join(__dirname, '..', 'static', 'models');
const IMAGES_SHOP_DIR = path.join(__dirname, '..', 'static', 'images', 'shop');

/**
 * INICIALIZACIÓN DE DIRECTORIOS
 * Asegura que el servidor tenga donde guardar los archivos antes de procesar peticiones
 */
const initializeStorage = () => {
    try {
        if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
        if (!fs.existsSync(IMAGES_SHOP_DIR)) fs.mkdirSync(IMAGES_SHOP_DIR, { recursive: true });
        console.log('✔ Directorios de almacenamiento verificados.');
    } catch (err) {
        console.error('✘ Error creando directorios:', err);
    }
};
initializeStorage();

// FILTRO DE SEGURIDAD PARA SUBIDA DE ARCHIVOS
const allowedExtensions = ['bbmodel', 'json', 'obj', 'png', 'jpg', 'jpeg', 'gif'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Extensión .${ext} no permitida.`), false);
    }
};

/**
 * CONFIGURACIÓN DE ALMACENAMIENTO DINÁMICO (MULTER)
 * Organiza los modelos por categoría y las imágenes en la carpeta de la tienda
 */
const cosmeticStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'model_file') {
            const category = req.body.category || 'misc';
            const categoryDir = path.join(MODELS_DIR, category);
            if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });
            cb(null, categoryDir);
        } else if (file.fieldname === 'image_file') {
            cb(null, IMAGES_SHOP_DIR);
        } else {
            cb(new Error('Campo de archivo no reconocido.'), false);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const uploadCosmetic = multer({ 
    storage: cosmeticStorage, 
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

const geminiUpload = multer({ storage: multer.memoryStorage() });

// =========================================================================
// 1. GESTIÓN DE COSMÉTICOS (TIENDA Y MODELOS 3D)
// =========================================================================

/**
 * POST /api/admin/cosmetics/create
 * Crea un nuevo ítem en la tienda con validación estricta de archivos
 */
router.post('/api/admin/cosmetics/create', adminRequired, uploadCosmetic.fields([
    { name: 'model_file', maxCount: 1 }, 
    { name: 'image_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const { name, description, price, rarity, category } = req.body;

        // Validación de existencia de archivos
        if (!req.files || !req.files['model_file'] || !req.files['image_file']) {
            if (req.files) {
                if (req.files['model_file']) fs.unlinkSync(req.files['model_file'][0].path);
                if (req.files['image_file']) fs.unlinkSync(req.files['image_file'][0].path);
            }
            return res.status(400).json({ success: false, message: 'Se requieren ambos archivos: Modelo (.bbmodel/obj) e Imagen.' });
        }

        const modelFile = req.files['model_file'][0];
        const imageFile = req.files['image_file'][0];

        // Validación de campos obligatorios
        if (!name || !description || !price || !rarity || !category) {
            fs.unlinkSync(modelFile.path);
            fs.unlinkSync(imageFile.path);
            return res.status(400).json({ success: false, message: 'Todos los campos de texto son obligatorios.' });
        }

        const newCosmetic = await CosmeticItem.create({
            name,
            description,
            price: parseInt(price),
            rarity,
            category,
            image_path: `/images/shop/${imageFile.filename}`,
            model_path: `/models/${category}/${modelFile.filename}`,
        });

        console.log(`[ADMIN] Cosmético creado: ${name}`);
        res.status(201).json({ success: true, message: 'Cosmético registrado con éxito.', item: newCosmetic });

    } catch (error) {
        console.error('Error Crítico al crear cosmético:', error);
        res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
    }
});

/**
 * DELETE /api/admin/cosmetics/:id
 * Elimina el registro y los archivos físicos del servidor
 */
router.delete('/api/admin/cosmetics/:id', adminRequired, async (req, res) => {
    try {
        const item = await CosmeticItem.findByPk(req.params.id);
        if (!item) return res.status(404).json({ message: 'El ítem no existe en la base de datos.' });

        const paths = [
            path.join(__dirname, '..', 'static', item.model_path),
            path.join(__dirname, '..', 'static', item.image_path)
        ];

        paths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

        await item.destroy();
        res.json({ success: true, message: 'Ítem y archivos eliminados del sistema.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================================
// 2. CONTROL DE USUARIOS Y SEGURIDAD
// =========================================================================

/**
 * GET /api/admin/users
 * Retorna todos los usuarios con datos de baneo incluidos
 */
router.get('/api/admin/users', adminRequired, async (req, res) => {
    try {
        const users = await User.findAll({
            order: [['registration_date', 'DESC']],
            attributes: ['id', 'username', 'role', 'is_admin', 'registration_date', 'avatar_url', 'is_banned', 'banned_until', 'ban_reason']
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al consultar la base de datos de usuarios.' });
    }
});

/**
 * POST /api/admin/update_user
 * Modifica roles y estatus administrativo
 */
router.post('/api/admin/update_user', adminRequired, async (req, res) => {
    try {
        const { user_id, role, is_admin } = req.body;
        const user = await User.findByPk(user_id);
        
        if (!user) return res.status(404).json({ message: 'Usuario no localizado.' });
        
        if (role !== undefined) user.role = role;
        if (is_admin !== undefined) user.is_admin = (is_admin === 'true' || is_admin === true);
        
        await user.save();
        console.log(`[ADMIN] Usuario ${user.username} actualizado.`);
        res.status(200).json({ success: true, message: 'Cambios aplicados correctamente.' });
    } catch (error) {
        res.status(500).json({ message: 'Error interno en la actualización.' });
    }
});

/**
 * POST /api/admin/users/ban
 * Gestiona el acceso de los usuarios al sistema
 */
router.post('/api/admin/users/ban', adminRequired, async (req, res) => {
    try {
        const { user_id, duration_hours, reason } = req.body;
        const user = await User.findByPk(user_id);

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        if (user.is_admin) return res.status(403).json({ message: 'No se permite banear cuentas de administración.' });

        if (parseInt(duration_hours) === 0) {
            user.is_banned = false;
            user.banned_until = null;
            user.ban_reason = null;
        } else {
            user.is_banned = true;
            user.banned_until = new Date(Date.now() + parseInt(duration_hours) * 3600000);
            user.ban_reason = reason || 'Incumplimiento de normas.';
        }
        
        await user.save();
        res.json({ success: true, message: user.is_banned ? 'Usuario baneado.' : 'Usuario indultado.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================================================================
// 3. MANTENIMIENTO Y WIPE SYSTEM
// =========================================================================

/**
 * POST /api/admin/wipe_all_data
 * Limpieza profunda de la base de datos (Chat y Usuarios)
 */
router.post('/api/admin/wipe_all_data', adminRequired, async (req, res) => {
    try {
        console.warn('[ALERTA] Iniciando Wipe General por petición de administrador.');
        
        // 1. Limpiar mensajes de chat (Truncate reinicia IDs)
        await ChatMessage.destroy({ truncate: true, cascade: false });
        
        // 2. Eliminar usuarios que no son administradores
        const deletedCount = await User.destroy({ where: { is_admin: false } });
        
        res.status(200).json({ 
            success: true, 
            message: `Wipe exitoso. Usuarios eliminados: ${deletedCount}. Chat vaciado.` 
        });
    } catch (error) {
        console.error('[ERROR] Fallo en el Wipe:', error);
        res.status(500).json({ message: `Fallo crítico: ${error.message}` });
    }
});

// =========================================================================
// 4. INTELIGENCIA ARTIFICIAL (GEMINI 1.5 PRO)
// =========================================================================

/**
 * POST /api/gemini-chat
 * Asistente IA para el panel administrativo con filtros de seguridad
 */
router.post('/api/gemini-chat', adminRequired, geminiUpload.single('file'), async (req, res) => {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ answer: "Error: GEMINI_API_KEY no definida en el entorno." });

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const { history, section, message } = req.body;
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", // Modelo actualizado y rápido
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
            ]
        });

        const chat = model.startChat({
            history: JSON.parse(history || '[]'),
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
        });

        const prompt = `Actúa como soporte técnico de GLauncher. Contexto actual: ${section}. Pregunta del Admin: ${message}`;
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        
        res.json({ success: true, answer: response.text() });
    } catch (error) {
        console.error('IA Error:', error);
        res.status(500).json({ success: false, answer: `Error de conexión con la IA: ${error.message}` });
    }
});

// =========================================================================
// 5. API YOUTUBE V3 (BÚSQUEDA MULTIMEDIA)
// =========================================================================

/**
 * GET /api/youtube/search
 * Busca contenido de video para integrar en el launcher
 */
router.get('/api/youtube/search', adminRequired, async (req, res) => {
    const { q } = req.query;
    const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!q) return res.status(400).json({ error: 'Falta término de búsqueda.' });
    if (!YOUTUBE_KEY) return res.status(500).json({ error: 'YouTube Key no configurada.' });

    try {
        const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_KEY });
        const response = await youtube.search.list({
            q: q,
            part: 'snippet',
            maxResults: 12,
            type: 'video',
            relevanceLanguage: 'es'
        });

        const results = response.data.items.map(v => ({
            title: v.snippet.title,
            id: v.id.videoId,
            thumb: v.snippet.thumbnails.high.url,
            channel: v.snippet.channelTitle
        }));

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: `YouTube API Error: ${error.message}` });
    }
});

// =========================================================================
// 6. MONITORIZACIÓN DE SISTEMA (HEALTH CHECK)
// =========================================================================

/**
 * GET /api/admin/status
 * Verifica la salud de todos los servicios vinculados
 */
router.get('/api/admin/status', adminRequired, async (req, res) => {
    try {
        const dbStatus = await User.sequelize.query('SELECT 1+1 AS result');
        
        res.json({
            backend: { status: 'online', uptime: Math.floor(process.uptime()), memory: process.memoryUsage().heapUsed },
            database: { status: dbStatus ? 'connected' : 'error', type: 'PostgreSQL' },
            pusher: { status: 'active', cluster: process.env.PUSHER_CLUSTER },
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({ status: 'partial_failure', database: 'disconnected' });
    }
});

// =========================================================================
// 7. INICIALIZADOR MAESTRO (FIRST RUN)
// =========================================================================

/**
 * GET /create_first_admin
 * Ruta de emergencia para crear el primer usuario administrativo
 */
router.get('/create_first_admin', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ where: { is_admin: true } });
        if (existingAdmin) return res.status(403).send("El sistema ya cuenta con administradores activos.");

        const passHash = await bcrypt.hash("password123", 12);
        const master = await User.create({
            username: "admin",
            password_hash: passHash,
            is_admin: true,
            role: "Pico de Netherite",
            registration_date: new Date()
        });

        res.status(201).send(`✔ Admin maestro '${master.username}' creado con éxito. Use 'password123' para entrar.`);
    } catch (error) {
        console.error('Master Admin Creation Error:', error);
        res.status(500).send(`Error fatal: ${error.message}`);
    }
});

// EXPORTACIÓN DEL MÓDULO CORREGIDO
module.exports = router;