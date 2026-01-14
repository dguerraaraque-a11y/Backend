document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.querySelector('.news-feed'); // El div donde se inyectarán las noticias

    // URL del backend en producción.
    const BACKEND_URL = "https://glauncher-api.onrender.com"; 

    /**
     * Función para crear el HTML de una tarjeta de noticia
     * @param {Object} item - Objeto con datos de la noticia
     */
    function createNewsCard(item) {
        // Mapea la categoría a una clase CSS para el color
        const categoryLower = item.category.toLowerCase();
        const categoryColorClass = categoryLower === "oficial" ? "text-neon-pink" : "text-neon-green";
        const buttonColorClass = categoryLower === "oficial" ? "button-pink" : "button-green";
        const iconHtml = item.icon ? `<i class="fas ${item.icon}"></i> ` : '';
        
        const card = document.createElement('div');
        card.className = `news-card`; // news-styles.css ya maneja el estilo base
        card.setAttribute('data-category', categoryLower);

        // Determinar si la ruta de la imagen es local o del backend
        const imageUrl = item.image.startsWith('/uploads/') ? `${BACKEND_URL}${item.image}` : item.image;

        card.innerHTML = `
            <img src="${imageUrl}" alt="${item.title}" class="news-card-image">
            <div class="news-card-content">
                <div class="news-header">
                    <span class="news-category ${categoryColorClass}">${item.category}</span>
                <span class="news-date">${item.date}</span>
                </div>
                <h3 class="news-title">${iconHtml}${item.title}</h3>
                <p class="news-summary">${item.summary}</p>
                <a href="${item.link}" ${item.link.startsWith('http') ? 'target="_blank"' : ''} class="news-button neon-button-glow ${buttonColorClass}">${item.buttonText}</a>
            </div>
        `;
        
        return card;
    }

    /**
     * Función para cargar noticias desde el backend
     */
    async function loadNews() {
        // Si no existe el contenedor de noticias, no hacemos nada.
        if (!newsContainer) {
            return;
        }

        newsContainer.innerHTML = '<p style="color: var(--text-color-dark); text-align: center;">Cargando noticias...</p>';

        try {
            const response = await fetch(`${BACKEND_URL}/api/news`); // Petición a la nueva API
            if (!response.ok) {
                throw new Error(`Error HTTP! estado: ${response.status}`);
            }
            const newsData = await response.json();

            newsContainer.innerHTML = ''; // Limpiar el mensaje de carga o cualquier contenido previo
            newsData.forEach(newsItem => {
                const card = createNewsCard(newsItem);
                newsContainer.appendChild(card);
            });

        } catch (error) {
            console.error('Error al obtener las noticias:', error);
            newsContainer.innerHTML = '<p style="color: var(--neon-pink); text-align: center;">Error al cargar las noticias. Inténtalo de nuevo más tarde.</p>';
        }
    }

    // Carga las noticias al iniciar la página
    loadNews();

    // Lógica de filtrado (se mantiene igual, pero ahora opera sobre las tarjetas dinámicas)
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.dataset.filter;
            const newsCards = document.querySelectorAll('.news-card'); // Consulta las tarjetas recién cargadas

            newsCards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
});