const express = require('express');
const { publicEndpoint } = require('../auth/middleware');
const News = require('../models/News');

const router = express.Router();

// Get all news items
router.get('/', publicEndpoint, async (req, res) => { // CORREGIDO: de '/news' a '/'
    try {
        const newsItems = await News.findAll({ order: [['id', 'DESC']] });

        if (newsItems.length > 0) {
            const newsData = newsItems.map(item => ({
                id: item.id,
                title: item.title,
                date: item.date,
                category: item.category,
                summary: item.summary,
                image: item.image,
                link: item.link,
                icon: item.icon,
                buttonText: item.buttonText,
            }));
            return res.json(newsData);
        } else {
            // If no news in DB, return example data
            return res.json([
                {
                    id: 1,
                    title: "¡Bienvenido al nuevo GLauncher!",
                    date: "20 OCT 2025",
                    category: "oficial",
                    summary: "Esta es una noticia de ejemplo. El panel de administración ahora está conectado a la base de datos. ¡Crea tu primera noticia!",
                    image: "/images/GLauncher_X_TropiRumba.png",
                    link: "#",
                    icon: "fa-rocket",
                    buttonText: "Empezar"
                }
            ]);
        }
    } catch (error) {
        console.error("Error al acceder a la tabla News:", error);
        // Always return example data on error in this specific case, as in Python app
        return res.json([
            {
                id: 1,
                title: "¡Bienvenido al nuevo GLauncher!",
                date: "20 OCT 2025",
                category: "oficial",
                summary: "Esta es una noticia de ejemplo. El panel de administración ahora está conectado a la base de datos. ¡Crea tu primera noticia!",
                image: "/images/GLauncher_X_TropiRumba.png",
                link: "#",
                icon: "fa-rocket",
                buttonText: "Empezar"
            }
        ]);
    }
});

module.exports = router;
