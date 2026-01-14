document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';
    const DEFAULT_AVATAR_URL = 'https://crafatar.com/avatars/606e2ff0-ed77-4842-9d6c-e1d3321c7838?size=100&overlay'; // Steve Avatar
    const PUSHER_KEY = 'a2fb8d4323a44da53c63'; // Tu clave de Pusher
    const token = localStorage.getItem('glauncher_token');

    // --- FLOATING NAV LOGIC ---
    const navItems = document.querySelectorAll('.floating-nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            if (item.id === 'admin-nav-button') {
                window.location.href = '/admin.html';
                return;
            }
            const targetId = item.dataset.target;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) section.classList.add('active');
            });
        });
    });

    // --- AUTH CHECK ---
    if (!token) {
        // Modo de demostración si no hay token
        loadDemoData();
        return;
    }

    // --- LOAD USER DATA ---
    async function loadUserData() {
        const headers = { 'Authorization': `Bearer ${token}` };
        try {
            const [userResponse, friendsResponse, cosmeticsResponse] = await Promise.all([
                fetch(`${BACKEND_URL}/api/user_info`, { headers }),
                fetch(`${BACKEND_URL}/api/friends`, { headers }),
                fetch(`${BACKEND_URL}/api/shop/items`, { headers })
            ]);

            if (!userResponse.ok) {
                if (userResponse.status === 401) {
                    localStorage.removeItem('glauncher_token');
                    window.location.href = '/login.html?error=session_expired';
                }
                throw new Error('No se pudo cargar la información del usuario.');
            }

            const userData = await userResponse.json();
            const friendsData = await friendsResponse.json();
            const allCosmetics = await cosmeticsResponse.json();

            initializeRealtimeNotifications(userData, friendsData);
            populateSidebar(userData);
            populateStats(userData);
            renderFriendsList(friendsData);
            setupFriendSearch(userData.id, friendsData);
            // Pasamos userData a la inicialización de ajustes
            initializeSettings(userData);
            initializeAchievements(userData);
            initializeStatusSystem(userData);
            initializeGChat(userData, friendsData);
            renderSkinsInventory(userData.owned_cosmetics, allCosmetics);

        } catch (error) {
            console.error("Error al cargar datos de usuario:", error);
            window.showNotification(error.message, 'error');
            loadDemoData(); // Cargar datos de demo si hay un error
        }
    }

    function populateSidebar(userData) {
        document.getElementById('nav-avatar').src = userData.avatar_url || DEFAULT_AVATAR_URL;
        document.getElementById('nav-username').textContent = userData.username;
        document.getElementById('user-role').textContent = userData.role;
        document.getElementById('user-role-container').style.display = 'block';

        if (userData.is_admin) {
            document.getElementById('admin-nav-button').style.display = 'flex';
        }

        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('glauncher_token');
            window.showNotification('Has cerrado sesión.', 'success');
            setTimeout(() => window.location.href = '/index.html', 1500);
        });

        document.getElementById('launch-game-btn').addEventListener('click', () => {
            window.showNotification('Iniciando GLauncher...', 'info');
            window.location.href = 'glauncher://'; // Protocolo personalizado
        });
    }

    function populateStats(userData) {
        document.getElementById('stat-gcoins').textContent = userData.gcoins.toLocaleString('es-ES');
        document.getElementById('stat-cosmetics').textContent = userData.owned_cosmetics.length;
        document.getElementById('stat-register-date').textContent = new Date(userData.registration_date).toLocaleDateString('es-ES');
        // Placeholder para tiempo de juego
        document.getElementById('stat-playtime').textContent = `${Math.floor(userData.play_time_seconds / 3600)}h`;
    }

    function renderFriendsList(friendsData) {
        const friendsListContainer = document.getElementById('friends-list');
        friendsListContainer.innerHTML = '';
        const { friends, pending, sent } = friendsData;

        // Renderizar solicitudes pendientes
        if (pending.length > 0) {
            friendsListContainer.innerHTML += '<h4><i class="fas fa-inbox"></i> Solicitudes Pendientes</h4>';
            pending.forEach(user => {
                friendsListContainer.innerHTML += `
                    <div class="friend-item" data-user-id="${user.id}" data-user-status="${user.status || 'Disponible'}">
                        <img src="${user.avatar_url || DEFAULT_AVATAR_URL}" alt="Avatar" class="friend-avatar">
                        <div class="friend-info">
                            <span class="friend-name">
                                <span class="status-indicator online"></span>
                                ${user.username}
                            </span>
                            <span class="friend-role">${user.role}</span>
                        </div>
                        <div class="friend-actions">
                            <button class="action-btn accept-btn" title="Aceptar"><i class="fas fa-check"></i></button>
                            <button class="action-btn remove-btn" title="Rechazar"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
            });
        }

        // Renderizar amigos
        friendsListContainer.innerHTML += '<h4><i class="fas fa-user-friends"></i> Mis Amigos</h4>';
        if (friends.length > 0) {
            friends.forEach(user => {
                friendsListContainer.innerHTML += `
                    <div class="friend-item" data-user-id="${user.id}" data-user-status="${user.status || 'Disponible'}">
                        <img src="${user.avatar_url || DEFAULT_AVATAR_URL}" alt="Avatar" class="friend-avatar">
                        <div class="friend-info">
                            <span class="friend-name">
                                <span class="status-indicator online"></span>
                                ${user.username}
                            </span>
                            <span class="friend-role">${user.role}</span>
                        </div>
                        <div class="friend-actions">
                            <button class="action-btn remove-btn" title="Eliminar Amigo"><i class="fas fa-user-minus"></i></button>
                        </div>
                    </div>
                `;
            });
        } else {
            friendsListContainer.innerHTML += '<p class="placeholder-content">Aún no tienes amigos. ¡Busca a alguien!</p>';
        }

        // Renderizar solicitudes enviadas
        if (sent.length > 0) {
            friendsListContainer.innerHTML += '<h4><i class="fas fa-paper-plane"></i> Solicitudes Enviadas</h4>';
            sent.forEach(user => {
                friendsListContainer.innerHTML += `
                    <div class="friend-item" data-user-id="${user.id}" data-user-status="${user.status || 'Disponible'}">
                        <img src="${user.avatar_url || DEFAULT_AVATAR_URL}" alt="Avatar" class="friend-avatar">
                        <div class="friend-info">
                            <span class="friend-name">
                                <span class="status-indicator online"></span>
                                ${user.username}
                            </span>
                            <span class="friend-role">${user.role}</span>
                        </div>
                        <div class="friend-actions">
                            <button class="action-btn remove-btn" title="Cancelar Solicitud"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
            });
        }
        updateAllStatusIndicators();
    }

    // --- LÓGICA DE GESTIÓN DE AMIGOS ---
    async function handleFriendAction(action, friendId) {
        const urlMap = {
            accept: `${BACKEND_URL}/api/friends/accept`,
            remove: `${BACKEND_URL}/api/friends/remove`,
            add: `${BACKEND_URL}/api/friends/add`,
        };
        const url = urlMap[action];
        const body = action === 'add' ? { username: friendId } : { friend_id: friendId };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            window.showNotification(result.message, 'success');
            // Recargar la lista de amigos para ver los cambios
            const friendsResponse = await fetch(`${BACKEND_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
            const friendsData = await friendsResponse.json();
            renderFriendsList(friendsData);

        } catch (error) {
            window.showNotification(error.message, 'error');
        }
    }

    document.getElementById('friends-list').addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;

        const friendItem = target.closest('.friend-item');
        const friendId = friendItem.dataset.userId;

        if (target.classList.contains('accept-btn')) {
            handleFriendAction('accept', friendId);
        } else if (target.classList.contains('remove-btn')) {
            handleFriendAction('remove', friendId);
        } else if (target.classList.contains('add-friend-btn')) {
            // El botón de añadir viene de la búsqueda, el ID es el nombre de usuario
            handleFriendAction('add', friendItem.dataset.username);
        }
    });

    async function setupFriendSearch(currentUserId, friendsData) {
        const searchInput = document.getElementById('friend-search-input');
        const friendsListContainer = document.getElementById('friends-list');
        const allUsersResponse = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const allUsers = await allUsersResponse.json();

        searchInput.addEventListener('keyup', () => {
            const query = searchInput.value.toLowerCase();
            if (query.length < 2) {
                renderFriendsList(friendsData); // Si la búsqueda está vacía, mostrar la lista normal
                return;
            }
            
            const filteredUsers = allUsers.filter(user => user.username.toLowerCase().includes(query) && user.id !== currentUserId);
            renderSearchResults(filteredUsers, friendsData);
        });
    }

    function setupFriendSearch(allUsers) {
        const searchInput = document.getElementById('friend-search-input');
        searchInput.addEventListener('keyup', () => {
            const query = searchInput.value.toLowerCase();
            const filteredUsers = allUsers.filter(user => user.username.toLowerCase().includes(query));
            renderFriendsList(filteredUsers);
        });
    }

    // --- LÓGICA DE GCHAT (MENSAJERÍA PRIVADA) ---
    function initializeGChat(userData, friendsData) {
        const conversationList = document.getElementById('gchat-conversation-list');
        const messagesContainer = document.getElementById('gchat-messages-container');
        const inputForm = document.getElementById('gchat-input-form');
        const chatHeader = document.getElementById('gchat-header-username');
        const welcomeScreen = document.getElementById('gchat-welcome-screen');
        let currentRecipient = null;
        let chatChannel = null;

        // 1. Poblar la lista de conversaciones con amigos
        conversationList.innerHTML = '';
        if (friendsData.friends.length > 0) {
            friendsData.friends.forEach(friend => {
                const convoItem = document.createElement('div');
                convoItem.className = 'gchat-conversation-item';
                convoItem.dataset.friendId = friend.id;
                convoItem.dataset.friendName = friend.username;
                convoItem.dataset.userStatus = friend.status || 'Disponible';
                convoItem.innerHTML = `
                    <img src="${friend.avatar_url || DEFAULT_AVATAR_URL}" alt="Avatar" class="friend-avatar">
                    <div class="friend-info">
                        <span class="friend-name">
                            <span class="status-indicator online"></span>
                            ${friend.username}
                        </span>
                    </div>
                `;
                conversationList.appendChild(convoItem);
            });
        } else {
            conversationList.innerHTML = '<p class="placeholder-content">Agrega amigos para chatear.</p>';
        }
        updateAllStatusIndicators();

        // 2. Manejar clic en una conversación
        conversationList.addEventListener('click', async (e) => {
            const target = e.target.closest('.gchat-conversation-item');
            if (!target) return;

            // Resaltar conversación activa
            document.querySelectorAll('.gchat-conversation-item').forEach(item => item.classList.remove('active'));
            target.classList.add('active');

            const friendId = target.dataset.friendId;
            const friendName = target.dataset.friendName;
            currentRecipient = { id: friendId, username: friendName };

            // Mostrar la ventana de chat
            welcomeScreen.style.display = 'none';
            messagesContainer.style.display = 'block';
            inputForm.style.display = 'flex';
            chatHeader.textContent = friendName;

            // Cargar historial y suscribirse al canal
            await loadChatHistory(friendId);
            subscribeToChatChannel(userData.id, friendId);
        });

        // 3. Cargar historial de mensajes
        async function loadChatHistory(friendId) {
            messagesContainer.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
            try {
                const response = await fetch(`${BACKEND_URL}/api/gchat/history/${friendId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const messages = await response.json();
                messagesContainer.innerHTML = '';
                messages.forEach(renderPrivateMessage);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                messagesContainer.innerHTML = '<p class="placeholder-content">Error al cargar el historial.</p>';
            }
        }

        // 4. Renderizar un mensaje privado
        function renderPrivateMessage(msg) {
            const messageEl = document.createElement('div');
            const isSent = msg.sender_id === userData.id;
            messageEl.className = `gchat-message ${isSent ? 'sent' : 'received'}`;
            messageEl.innerHTML = `<p>${msg.content}</p>`;
            messagesContainer.appendChild(messageEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // 5. Suscribirse al canal de Pusher
        function subscribeToChatChannel(userId, friendId) {
            // Desuscribirse del canal anterior si existe
            if (chatChannel) {
                pusher.unsubscribe(chatChannel.name);
            }

            const channelName = `private-chat-${Math.min(userId, friendId)}-${Math.max(userId, friendId)}`;
            chatChannel = pusher.subscribe(channelName);

            chatChannel.bind('pusher:subscription_error', (status) => {
                console.error(`Error al suscribirse al canal de GChat: ${status}`);
                window.showNotification('Error de conexión con el chat en tiempo real.', 'error');
            });

            chatChannel.bind('new_message', (data) => {
                // Solo renderizar si el mensaje pertenece a la conversación activa
                if (currentRecipient && (data.sender_id == currentRecipient.id || data.recipient_id == currentRecipient.id)) {
                    renderPrivateMessage(data);
                } else {
                    // Opcional: mostrar notificación de nuevo mensaje de otro chat
                    window.showNotification(`Nuevo mensaje de otro chat.`, 'info');
                }
            });
        }

        // 6. Enviar un mensaje
        inputForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('gchat-message-input');
            const content = input.value.trim();

            if (!content || !currentRecipient) return;

            input.value = ''; // Limpiar el input inmediatamente

            try {
                await fetch(`${BACKEND_URL}/api/gchat/send/${currentRecipient.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ content })
                });
            } catch (error) {
                window.showNotification('Error al enviar el mensaje.', 'error');
                input.value = content; // Restaurar el mensaje si falla el envío
            }
        });
    }

    function renderSkinsInventory(ownedIds, allCosmetics) {
        const skinsGrid = document.getElementById('skins-inventory-grid');
        skinsGrid.innerHTML = '';
        const ownedCosmetics = allCosmetics.filter(item => ownedIds.includes(item.id));

        if (ownedCosmetics.length === 0) {
            skinsGrid.innerHTML = '<p class="placeholder-content">Aún no tienes cosméticos. ¡Visita la tienda para conseguir algunos!</p>';
            return;
        }

        ownedCosmetics.forEach(item => {
            const skinCard = document.createElement('div');
            skinCard.className = 'skin-card';
            skinCard.innerHTML = `
                <img src="${BACKEND_URL}${item.image_url}" alt="${item.name}" class="skin-image">
                <p class="skin-name">${item.name}</p>
            `;
            skinsGrid.appendChild(skinCard);
        });
    }

    // --- LÓGICA DE LOGROS ---
    function initializeAchievements(userData) {
        const achievements = [
            { id: 'pioneer', title: 'Pionero', description: 'Regístrate durante la fase BETA.', icon: 'images/achievements/pioneer.png', recommended: true, isUnlocked: (data) => new Date(data.registration_date) < new Date('2026-01-01') },
            { id: 'collector', title: 'Primer Comprador', description: 'Adquiere tu primer cosmético en la tienda.', icon: 'images/achievements/collector.png', recommended: true, isUnlocked: (data) => data.owned_cosmetics.length > 0 },
            { id: 'veteran', title: 'Veterano', description: 'Lleva más de 3 meses en la comunidad.', icon: 'images/achievements/explorer.png', recommended: false, isUnlocked: (data) => (new Date() - new Date(data.registration_date)) / (1000 * 60 * 60 * 24 * 30) >= 3 },
            { id: 'fashionista', title: 'Fashionista', description: 'Consigue 5 o más cosméticos.', icon: 'images/achievements/socialite.png', recommended: true, isUnlocked: (data) => data.owned_cosmetics.length >= 5 },
            { id: 'rich', title: 'Adinerado', description: 'Acumula 1,000 GCoins.', icon: 'images/achievements/pioneer.png', recommended: false, isUnlocked: (data) => data.gcoins >= 1000 },
        ];

        const grid = document.getElementById('achievements-grid');
        const filterButtons = document.querySelectorAll('.achievements-filter-controls .filter-btn');

        function renderAchievements(filter = 'all') {
            grid.innerHTML = '';
            const userAchievements = achievements.map(ach => ({
                ...ach,
                unlocked: ach.isUnlocked(userData)
            }));

            let filteredAchievements = userAchievements;

            switch (filter) {
                case 'unlocked':
                    filteredAchievements = userAchievements.filter(a => a.unlocked);
                    break;
                case 'locked':
                    filteredAchievements = userAchievements.filter(a => !a.unlocked);
                    break;
                case 'recommended':
                    filteredAchievements = userAchievements.filter(a => a.recommended && !a.unlocked);
                    break;
            }

            if (filteredAchievements.length === 0) {
                grid.innerHTML = '<p class="placeholder-content">No hay logros en esta categoría.</p>';
                return;
            }

            filteredAchievements.forEach(ach => {
                const card = document.createElement('div');
                card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
                card.innerHTML = `
                    <img src="${ach.icon}" class="achievement-icon" alt="${ach.title}">
                    <div class="achievement-info">
                        <h4>${ach.title}</h4>
                        <p>${ach.description}</p>
                        <div class="achievement-progress">
                            <div class="progress-bar" style="width: ${ach.unlocked ? '100%' : '0%'}"></div>
                        </div>
                    </div>
                    <div class="achievement-actions">
                        <button class="reaction-btn" data-achievement-id="${ach.id}" title="Reaccionar">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <span class="reaction-count">0</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                renderAchievements(button.dataset.filter);
            });
        });

        // Render inicial
        renderAchievements();

        // Lógica de Reacciones (placeholder)
        grid.addEventListener('click', (e) => {
            const reactionBtn = e.target.closest('.reaction-btn');
            if (reactionBtn) {
                const achievementId = reactionBtn.dataset.achievementId;
                // En una implementación completa, necesitarías el ID del usuario cuyo perfil estás viendo.
                // Por ahora, asumimos que reaccionas a tus propios logros como demostración.
                const targetUserId = userData.id; 
                reactToAchievement(achievementId, targetUserId, reactionBtn);
            }
        });
    }

    async function reactToAchievement(achievementId, targetUserId, button) {
        // Simulación visual: incrementa el contador y deshabilita el botón
        const countSpan = button.nextElementSibling;
        const currentCount = parseInt(countSpan.textContent);
        countSpan.textContent = currentCount + 1;
        button.disabled = true;
        button.classList.add('reacted');

        try {
            const response = await fetch(`${BACKEND_URL}/api/achievements/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ achievement_id: achievementId, target_user_id: targetUserId })
            });
            const result = await response.json();
            if (!response.ok) {
                // Si falla, revertir el cambio visual
                countSpan.textContent = currentCount;
                button.disabled = false;
                throw new Error(result.message);
            }
        } catch (error) { window.showNotification(`Error al reaccionar: ${error.message}`, 'error'); }
    }

    // --- LÓGICA DE AJUSTES ---
    function initializeSettings(userData) {
        const settingsForm = document.getElementById('account-settings-form');
        const avatarPreview = document.getElementById('settings-avatar-preview');
        const avatarFileInput = document.getElementById('avatar-change-file');

        // Poblar datos iniciales
        document.getElementById('username-change').value = userData.username;
        avatarPreview.src = userData.avatar_url || DEFAULT_AVATAR_URL;

        // Previsualización de avatar
        avatarFileInput.addEventListener('change', () => {
            const file = avatarFileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    avatarPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            // Lógica para enviar el formulario al backend
            try {
                const response = await fetch(`${BACKEND_URL}/api/user/update_profile`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                window.showNotification(result.message, 'success');
                setTimeout(() => window.location.reload(), 1500); // Recargar para ver cambios
            } catch (error) {
                window.showNotification(error.message, 'error');
            }
        });
    }

    function initializeDemoAchievements() {
        const achievements = [
            { id: 'pioneer', title: 'Pionero', description: 'Regístrate durante la fase BETA.', icon: 'images/achievements/pioneer.png', unlocked: true },
            { id: 'collector', title: 'Primer Comprador', description: 'Adquiere tu primer cosmético en la tienda.', icon: 'images/achievements/collector.png', unlocked: false },
            { id: 'veteran', title: 'Veterano', description: 'Lleva más de 3 meses en la comunidad.', icon: 'images/achievements/explorer.png', unlocked: false },
            { id: 'fashionista', title: 'Fashionista', description: 'Consigue 5 o más cosméticos.', icon: 'images/achievements/socialite.png', unlocked: false },
        ];
        const grid = document.getElementById('achievements-grid');
        const filterButtons = document.querySelectorAll('.achievements-filter-controls .filter-btn');

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                grid.innerHTML = '<p class="placeholder-content">Inicia sesión para ver y filtrar tus logros.</p>';
            });
        });

        grid.innerHTML = '';
        achievements.forEach(ach => {
            const card = document.createElement('div');
            card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <img src="${ach.icon}" class="achievement-icon" alt="${ach.title}">
                <h4>${ach.title}</h4><p>${ach.description}</p><div class="achievement-progress"><div class="progress-bar" style="width: ${ach.unlocked ? '100%' : '0%'}"></div></div>
                <div class="achievement-actions">
                    <button class="reaction-btn" title="Reaccionar"><i class="fas fa-thumbs-up"></i></button>
                    <span class="reaction-count">0</span></div>
            `;
            grid.appendChild(card);
        });
    }

    function loadDemoData() {
        // Ocultar elementos de usuario y mostrar mensaje de invitado
        const profileSection = document.getElementById('nav-profile-section');
        if (profileSection) {
            profileSection.style.display = 'none';
        }
        document.getElementById('nav-guest-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'none';
        
        // Actualizar el avatar y nombre en la sección de invitado
        const guestAvatar = document.querySelector('#nav-guest-section .nav-avatar');
        if (guestAvatar) guestAvatar.src = DEFAULT_AVATAR_URL;

        // Poblar estadísticas con datos de ejemplo
        document.getElementById('stat-gcoins').textContent = "0";
        document.getElementById('stat-cosmetics').textContent = "0";
        document.getElementById('stat-register-date').textContent = "--/--/----";
        document.getElementById('stat-playtime').textContent = "0h";

        // Poblar lista de amigos con datos de ejemplo
        const demoUsers = [
            { username: 'DaniCraftYT25', role: 'Pico de Netherite', avatar_url: 'https://crafatar.com/avatars/606e2ff0-ed77-4842-9d6c-e1d3321c7838?size=100&overlay' },
            { username: 'UsuarioAlfa', role: 'Pico de Diamante', avatar_url: null },
            { username: 'JugadorBeta', role: 'Pico de Oro', avatar_url: null }
        ];
        renderFriendsList(demoUsers);
        setupFriendSearch(demoUsers);

        // Mensaje en inventario de skins
        document.getElementById('skins-inventory-grid').innerHTML = '<p class="placeholder-content">Inicia sesión para ver tus cosméticos.</p>';

        // Inicializar logros en modo demo
        initializeDemoAchievements();
    }
    
    // --- LÓGICA DE NOTIFICACIONES EN TIEMPO REAL ---
    function initializeRealtimeNotifications(userData, friendsData) {
        const pusher = new Pusher(PUSHER_KEY, {
            cluster: 'us2',
            authEndpoint: `${BACKEND_URL}/pusher/auth`,
            auth: { headers: { 'Authorization': `Bearer ${token}` } }
        });

        // Canal de presencia global para saber quién está online
        const presenceChannel = pusher.subscribe('presence-glauncher-users');
        const friendIds = new Set(friendsData.friends.map(f => f.id));

        presenceChannel.bind('pusher:member_added', (member) => {
            // Notificar solo si el miembro añadido es un amigo y no soy yo mismo
            if (friendIds.has(member.id) && member.id !== userData.id) {
                window.showNotification(`🟢 ¡${member.info.username} se ha conectado!`, 'success');
            }
        });

        presenceChannel.bind('pusher:member_removed', (member) => {
            // Notificar solo si el miembro que se va es un amigo
            if (friendIds.has(member.id)) {
                window.showNotification(`🔴 ¡${member.info.username} se ha desconectado!`, 'info');
            }
        });
    }
    
    // --- LÓGICA DEL SISTEMA DE ESTADO ---
    function initializeStatusSystem(userData) {
        const statusDisplay = document.getElementById('status-display');
        const statusOptionsContainer = document.getElementById('status-options');
        const statuses = {
            'Disponible': 'online',
            'Ausente': 'away',
            'Jugando': 'playing'
        };

        // Poblar opciones
        statusOptionsContainer.innerHTML = Object.keys(statuses).map(status => 
            `<div class="status-option" data-status="${status}">
                <span class="status-indicator ${statuses[status]}"></span>
                ${status}
            </div>`
        ).join('');

        // Mostrar/ocultar menú
        statusDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            statusOptionsContainer.style.display = statusOptionsContainer.style.display === 'block' ? 'none' : 'block';
        });

        // Cambiar estado
        statusOptionsContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('.status-option');
            if (!target) return;

            const newStatus = target.dataset.status;
            statusOptionsContainer.style.display = 'none';
            updateStatusIndicator(document.getElementById('status-indicator'), newStatus);
            document.getElementById('status-text').textContent = newStatus;

            // Enviar al backend
            try {
                const response = await fetch(`${BACKEND_URL}/api/user/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ status: newStatus })
                });
                if (!response.ok) throw new Error('No se pudo actualizar el estado.');
            } catch (error) {
                window.showNotification(error.message, 'error');
            }
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', () => {
            statusOptionsContainer.style.display = 'none';
        });

        // Setear estado inicial
        updateStatusIndicator(document.getElementById('status-indicator'), userData.status);
        document.getElementById('status-text').textContent = userData.status;
    }

    function updateStatusIndicator(element, status) {
        if (!element) return;
        element.className = 'status-indicator'; // Reset
        if (status === 'Disponible') element.classList.add('online');
        else if (status === 'Ausente') element.classList.add('away');
        else if (status === 'Jugando') element.classList.add('playing');
    }

    function updateAllStatusIndicators() {
        document.querySelectorAll('[data-user-status]').forEach(el => {
            updateStatusIndicator(el.querySelector('.status-indicator'), el.dataset.userStatus);
        });
    }

    loadUserData();
});
