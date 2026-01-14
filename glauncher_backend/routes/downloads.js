const express = require('express');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminRequired, publicEndpoint } = require('../auth/middleware');
const Download = require('../models/Download');

const router = express.Router();

const frontendDir = path.join(__dirname, '..', '..', 'GLAUNCHER-WEB'); // Adjust path as needed
const downloadsDir = path.join(frontendDir, 'downloads');
fs.mkdirSync(downloadsDir, { recursive: true }); // Ensure downloads directory exists

// Multer storage for download file uploads
const downloadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, downloadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Keep original filename for downloads
    }
});

const uploadDownload = multer({ storage: downloadStorage });

// Get all downloads
router.get('/api/downloads', publicEndpoint, async (req, res) => {
    try {
        const downloads = await Download.findAll();
        res.json(downloads.map(d => ({
            id: d.id,
            platform: d.platform,
            version: d.version,
            icon_class: d.icon_class,
            filename: d.filename,
        })));
    } catch (error) {
        console.error('Error fetching downloads:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Download Windows installer
router.get('/api/download/windows', publicEndpoint, (req, res) => {
    const filePath = path.join(downloadsDir, 'GLauncher_Setup.exe');
    if (fs.existsSync(filePath)) {
        return res.download(filePath, 'GLauncher_Setup.exe');
    } else {
        return res.status(404).json({ error: 'El instalador no se encuentra disponible.' });
    }
});

// Get latest version for a platform
router.get('/api/updates/latest', publicEndpoint, async (req, res) => {
    const platform = req.query.platform || 'windows';
    try {
        const download = await Download.findOne({
            where: { platform },
            order: [['id', 'DESC']],
        });

        if (download) {
            return res.json({
                version: download.version,
                url: 'https://glauncher.vercel.app/download.html' // Assuming this is the frontend download page
            });
        }
        res.json({ version: '1.0.0', url: '' });
    } catch (error) {
        console.error('Error fetching latest version:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Download update JAR
router.get('/api/download/update-jar', publicEndpoint, (req, res) => {
    const filePath = path.join(downloadsDir, 'GLauncher.jar');
    if (fs.existsSync(filePath)) {
        return res.download(filePath, 'GLauncher.jar');
    } else {
        return res.status(404).json({ error: 'Archivo de actualización no encontrado.' });
    }
});

// Create a new download entry and upload file (Admin only)
router.post('/api/downloads/create', adminRequired, uploadDownload.single('download_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo.' });
        }

        const { platform, version, icon_class } = req.body;

        if (!platform || !version || !icon_class) {
            // Clean up the uploaded file if other data is missing
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Faltan campos requeridos (platform, version, icon_class).' });
        }

        const newDownload = await Download.create({
            platform,
            version,
            icon_class,
            file_path: `/downloads/${req.file.filename}`,
            filename: req.file.filename,
        });

        res.status(201).json({ message: 'Archivo subido y registrado con éxito.', download: newDownload });
    } catch (error) {
        console.error('Error creating download:', error);
        if (req.file) { // Attempt to clean up if an error occurred after upload
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: `Error al subir el archivo: ${error.message}` });
    }
});

// Delete a download entry and its file (Admin only)
router.delete('/api/downloads/delete/:download_id', adminRequired, async (req, res) => {
    try {
        const { download_id } = req.params;
        const download = await Download.findByPk(download_id);

        if (!download) {
            return res.status(404).json({ message: 'Descarga no encontrada.' });
        }

        const filePath = path.join(downloadsDir, download.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Delete the physical file
        }

        await download.destroy(); // Delete the database entry

        res.status(200).json({ message: 'Descarga eliminada correctamente.' });
    } catch (error) {
        console.error('Error deleting download:', error);
        res.status(500).json({ message: `Error al eliminar: ${error.message}` });
    }
});

module.exports = router;
