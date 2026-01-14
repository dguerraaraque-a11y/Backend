document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';
    const PUSHER_KEY = 'a2fb8d4323a44da53c63'; 
    const PUSHER_CLUSTER = 'us2';

    // --- Elementos del DOM ---
    const chatMessages = document.getElementById('chat-messages');
    const chatUsername = document.getElementById('chat-username');
    const chatMessageInput = document.getElementById('chat-message-input');
    const usernameColorInput = document.getElementById('username-color-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const userCountElement = document.getElementById('user-count');
    const emojiBtn = document.getElementById('emoji-btn');
    const pickerContainer = document.getElementById('picker-container');
    const notificationSound = document.getElementById('chat-notification-sound');

    // --- Lógica para resaltar el programa actual ---
    function highlightCurrentProgram() {
        const nowUTC = new Date();
        const venezuelaTime = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'America/Caracas' }));

        const currentDay = venezuelaTime.getDay(); // Domingo: 0, Lunes: 1, ..., Sábado: 6
        const currentTime = venezuelaTime.getHours().toString().padStart(2, '0') + ':' + venezuelaTime.getMinutes().toString().padStart(2, '0');

        const programCards = document.querySelectorAll('.program-card');
        
        programCards.forEach(card => {
            card.classList.remove('is-live'); // Limpiar clase anterior

            const days = card.dataset.days.split(',').flatMap(d => {
                if (d.includes('-')) {
                    const [start, end] = d.split('-').map(Number);
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                }
                return [Number(d)];
            });

            const startTime = card.dataset.start;
            const endTime = card.dataset.end;

            const isToday = days.includes(currentDay);
            const isTime = (startTime > endTime) ? (currentTime >= startTime || currentTime < endTime) : (currentTime >= startTime && currentTime < endTime);

            if (isToday && isTime) card.classList.add('is-live');
        });
    }

    // --- Lógica de Pestañas (Programación y Panel de Emojis) ---
    function setupTabs(tabContainerSelector, contentContainerSelector) {
        const tabButtons = document.querySelectorAll(`${tabContainerSelector} .prog-tab-button, ${tabContainerSelector} .picker-tab-btn`);
        const tabContents = document.querySelectorAll(`${contentContainerSelector} .prog-tab-content, ${contentContainerSelector} .picker-tab-content`);

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.tab;

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === targetId) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    setupTabs('.radio-prog-tabs', '.programming-section');
    setupTabs('.picker-tabs', '.picker-content');

    // --- Lógica del Chat ---

    // Cargar nombre de usuario y color guardados
    if (localStorage.getItem('glauncher_chat_username')) {
        chatUsername.value = localStorage.getItem('glauncher_chat_username');
    }
    if (localStorage.getItem('glauncher_chat_color')) {
        usernameColorInput.value = localStorage.getItem('glauncher_chat_color');
    }

    chatUsername.addEventListener('change', () => localStorage.setItem('glauncher_chat_username', chatUsername.value));
    usernameColorInput.addEventListener('input', () => localStorage.setItem('glauncher_chat_color', usernameColorInput.value));

    const roleIcons = {
        "Pico de Netherite": "images/Rols/Pico de Netherite.png", "Pico de Diamante": "images/Rols/Pico de Diamante.png",
        "Pico de Oro": "images/Rols/Pico de Oro.png", "Pico de Hierro": "images/Rols/Pico de Hierro.png",
        "Pico de Piedra": "images/Rols/Pico de Piedra.png", "Pico de madera": "images/Rols/Pico de madera.png",
        "Invitado": "images/Rols/Invitado.png"
    };

    function renderUsername(username, role, color) {
        // Si el rol es 'system', no se renderiza nada más que el nombre.
        if (role === 'system') return `<strong>${username}</strong>`;

        const roleClass = 'role-' + role.toLowerCase().replace(/ /g, '-');
        const iconSrc = roleIcons[role] || roleIcons["Invitado"];
        const style = color ? `style="color: ${color};"` : '';
        let roleHtml = (role !== 'Invitado' && role !== 'Pico de madera') ? `<span class="user-role-badge ${roleClass}"><img src="${iconSrc}" class="role-icon" alt="${role}"> ${role}</span>` : '';
        return `<strong class="username-text ${roleClass}" ${style}>${username}</strong>${roleHtml}`;
    }

    function addChatMessage(msg) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${msg.username === 'Sistema' ? 'system' : ''}`;
        const contentHTML = msg.type === 'gif' ? `<img src="${msg.content}" alt="GIF" class="chat-gif">` : msg.content;
        messageElement.innerHTML = `<p>${renderUsername(msg.username, msg.role, msg.username_color)}: ${contentHTML}</p>`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (chatUsername.value !== msg.username && notificationSound) {
            notificationSound.play().catch(e => console.warn("No se pudo reproducir el sonido de notificación."));
        }
    }

    async function loadInitialMessages() {
        // Limpiar el contenedor de mensajes antes de intentar cargar los nuevos.
        chatMessages.innerHTML = '';
        try {
            const response = await fetch(`${BACKEND_URL}/api/chat_messages`);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const messages = await response.json();
            messages.forEach(addChatMessage);
        } catch (error) {
            console.error("Error al cargar el historial del chat:", error);
            addChatMessage({ username: 'Sistema', content: 'Error al cargar el historial del chat. Inténtalo de nuevo más tarde.', type: 'text', role: 'system' });
        }
    }

    async function sendMessage(contentOverride = null, type = 'text') {
        const username = chatUsername.value.trim();
        const content = contentOverride || chatMessageInput.value.trim();
        const color = usernameColorInput.value;

        if (!username) return window.showNotification('Por favor, introduce un nombre de usuario.', 'error');
        if (!content) return window.showNotification('El mensaje no puede estar vacío.', 'error');

        sendChatBtn.disabled = true;
        sendChatBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('glauncher_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            await fetch(`${BACKEND_URL}/api/chat_messages/create`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ username, content, type, color })
            });
            if (type === 'text') chatMessageInput.value = '';
        } catch (error) {
            window.showNotification('Error al enviar el mensaje.', 'error');
        } finally {
            sendChatBtn.disabled = false;
            sendChatBtn.innerHTML = 'Enviar <i class="fas fa-paper-plane"></i>';
        }
    }

    sendChatBtn.addEventListener('click', () => sendMessage());
    chatMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // --- Lógica de Pusher para tiempo real ---
    const authHeaders = {};
    const token = localStorage.getItem('glauncher_token');
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        authEndpoint: `${BACKEND_URL}/pusher/auth`,
        auth: { headers: authHeaders }
    });

    const presenceChannel = pusher.subscribe('presence-chat_radio');

    const updateUserCount = () => {
        userCountElement.innerHTML = `<i class="fas fa-circle"></i> ${presenceChannel.members.count} usuarios en línea`;
    };

    presenceChannel.bind('pusher:subscription_succeeded', updateUserCount);
    presenceChannel.bind('pusher:member_added', updateUserCount);
    presenceChannel.bind('pusher:member_removed', updateUserCount);
    presenceChannel.bind('new_message', addChatMessage);

    // --- Lógica del Panel de Emojis/GIFs/Memes ---
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pickerContainer.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
        if (!pickerContainer.contains(e.target) && !emojiBtn.contains(e.target)) {
            pickerContainer.classList.remove('visible');
        }
    });

    document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
        chatMessageInput.value += event.detail.unicode;
    });

    const TENOR_API_KEY = "LIVDSRZULELA";
    const gifSearchInput = document.getElementById('gif-search-input');
    const gifResultsContainer = document.getElementById('gif-results');
    
    async function loadTrendingGifs() {
        gifResultsContainer.innerHTML = '<p class="gif-placeholder">Cargando GIFs populares...</p>';
        try {
            const response = await fetch(`https://g.tenor.com/v1/trending?key=${TENOR_API_KEY}&limit=48&media_filter=minimal`);
            renderGifs(await response.json());
        } catch (error) {
            gifResultsContainer.innerHTML = '<p class="gif-placeholder">No se pudieron cargar los GIFs.</p>';
        }
    }

    let gifSearchTimeout;
    gifSearchInput.addEventListener('keyup', () => {
        clearTimeout(gifSearchTimeout);
        gifSearchTimeout = setTimeout(async () => {
            const query = gifSearchInput.value.trim();
            if (query.length < 2) {
                if (query.length === 0) loadTrendingGifs();
                return;
            }
            gifResultsContainer.innerHTML = '<p class="gif-placeholder">Buscando...</p>';
            try {
                const response = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=48&media_filter=minimal`);
                renderGifs(await response.json());
            } catch (error) {
                gifResultsContainer.innerHTML = '<p class="gif-placeholder">Error al conectar con Tenor.</p>';
            }
        }, 500);
    });

    function renderGifs(data) {
        gifResultsContainer.innerHTML = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(gif => {
                const img = document.createElement('img');
                img.src = gif.media[0].tinygif.url;
                img.alt = gif.content_description;
                img.addEventListener('click', () => {
                    sendMessage(gif.media[0].gif.url, 'gif'); // Enviar GIF
                    pickerContainer.classList.remove('visible');
                });
                gifResultsContainer.appendChild(img);
            });
        } else {
            gifResultsContainer.innerHTML = '<p class="gif-placeholder">No se encontraron GIFs.</p>';
        }
    }

    // Cargar GIFs populares al abrir la pestaña por primera vez
    document.querySelector('[data-tab="gifs"]').addEventListener('click', () => {
        if (gifResultsContainer.childElementCount <= 1) {
            loadTrendingGifs();
        }
    });

    // --- Inicialización ---
    loadInitialMessages();
    highlightCurrentProgram();
    setInterval(highlightCurrentProgram, 60000);
});

/*
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            const activeTabContent = document.getElementById(tabId);
            activeTabContent.classList.add('active');
        });
    });
*/