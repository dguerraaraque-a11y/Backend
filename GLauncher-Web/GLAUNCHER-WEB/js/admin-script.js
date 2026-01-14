document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';
    let ADMIN_KEY = null; // Variable para almacenar la clave de admin
    // --- Elementos del DOM ---
    const newsList = document.getElementById('news-list');
    const newsForm = document.getElementById('news-form');
    const formTitle = document.getElementById('form-title');
    const newsIdInput = document.getElementById('news-id');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const addNewBtn = document.getElementById('add-new-btn');
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const logoutButton = document.getElementById('logout-btn');

    // --- Elementos del Dashboard ---
    const refreshStatusBtn = document.getElementById('refresh-status-btn');


    // --- Elementos del Chat Manager ---
    const systemMessageForm = document.getElementById('system-message-form');
    const systemMessageContent = document.getElementById('system-message-content');
    const adminChatView = document.getElementById('admin-chat-view');
    const deleteAllChatBtn = document.getElementById('delete-all-chat-btn');

    // --- Elementos del Download Manager ---
    const downloadForm = document.getElementById('download-form');
    const downloadsList = document.getElementById('downloads-list');

    // --- Elementos del User Manager ---
    const userTableBody = document.getElementById('user-table-body');

    // --- Elementos del Asistente Gemini ---
    const geminiChatWidget = document.getElementById('gemini-chat-widget');
    const geminiWidgetClose = document.getElementById('gemini-widget-close');
    const geminiChatLog = document.getElementById('gemini-chat-log');
    const geminiChatForm = document.getElementById('gemini-chat-form');
    const geminiChatInput = document.getElementById('gemini-chat-input');
    const geminiMicBtn = document.getElementById('gemini-mic-btn');
    const floatingGeminiBtn = document.getElementById('floating-gemini-btn');
    const geminiEmojiBtn = document.getElementById('gemini-emoji-btn');
    const geminiPickerContainer = document.getElementById('gemini-picker-container');
    const notificationSound = document.getElementById('chat-notification-sound');
    const geminiResetBtn = document.getElementById('gemini-reset-btn');
    let geminiChatHistory = []; // Array para almacenar el historial de la conversación

    let currentNews = [];
    let attachedFile = null; // Variable para el archivo adjunto
    let mediaRecorder; // Para grabar audio
    let audioChunks = [];

    const filePreviewContainer = document.getElementById('gemini-file-preview-container');
    const filePreviewText = document.getElementById('gemini-file-preview-text');
    const removeFileBtn = document.getElementById('gemini-remove-file-btn');
    let chatPollInterval = null; // Variable para controlar la actualización del chat

    async function loadNews() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/news`);
            currentNews = await response.json();
            renderNewsList();
        } catch (error) {
            newsList.innerHTML = '<p class="error-msg">Error al cargar noticias.</p>';
            console.error(error);
        }
    }

    function renderNewsList() {
        newsList.innerHTML = '';
        if (currentNews.length === 0) {
            newsList.innerHTML = '<p>No hay noticias para mostrar.</p>';
            return;
        }
        currentNews.forEach(item => {
            const newsItemDiv = document.createElement('div');
            newsItemDiv.className = 'news-list-item';
            newsItemDiv.innerHTML = `
                <div class="item-info" data-id="${item.id}">
                    <span class="item-date">${item.date}</span>
                    <span class="item-title">${item.title}</span>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            newsList.appendChild(newsItemDiv);
        });
    }

    // --- Lógica del Dashboard de Resumen ---
    async function loadDashboardStats() {
        // Cargar estadísticas numéricas
        try {
            const usersResponse = await fetch(`${BACKEND_URL}/api/admin/users`, { credentials: 'include' });
            const newsResponse = await fetch(`${BACKEND_URL}/api/news`);
            const downloadsResponse = await fetch(`${BACKEND_URL}/api/downloads`);

            if (usersResponse.ok) {
                const users = await usersResponse.json();
                document.getElementById('stat-total-users').textContent = users.length;
            }
            if (newsResponse.ok) {
                const news = await newsResponse.json();
                document.getElementById('stat-total-news').textContent = news.length;
            }
            if (downloadsResponse.ok) {
                const downloads = await downloadsResponse.json();
                document.getElementById('stat-total-downloads').textContent = downloads.length;
            }
        } catch (error) { console.error("Error al cargar estadísticas:", error); }
    }

    // --- Lógica para el Status Check del Dashboard ---
    async function checkSystemStatus() {
        const services = ['backend', 'gemini', 'pusher'];
        // Poner todo en estado de carga
        services.forEach(service => {
            const card = document.getElementById(`status-${service}`);
            const indicator = card.querySelector('.status-indicator');
            const text = card.querySelector('.status-text');
            indicator.className = 'status-indicator loading';
            text.textContent = 'Comprobando...';
        });

        try {
            const response = await fetch(`${BACKEND_URL}/api/admin/status`, { credentials: 'include' });
            if (!response.ok) throw new Error('No se pudo obtener el estado.');
            
            const statuses = await response.json();
            
            Object.keys(statuses).forEach(serviceKey => {
                const card = document.getElementById(`status-${serviceKey}`);
                if (card) {
                    const indicator = card.querySelector('.status-indicator');
                    const text = card.querySelector('.status-text');
                    const { status, message } = statuses[serviceKey];
                    
                    indicator.title = message; // Añadir tooltip con más info
                    indicator.className = `status-indicator ${status}`; // 'online' u 'offline'
                    text.textContent = message;
                }
            });

        } catch (error) {
            console.error("Error al comprobar el estado del sistema:", error);
            // Marcar el backend como offline si la petición principal falla
            const backendCard = document.getElementById('status-backend');
            backendCard.querySelector('.status-indicator').className = 'status-indicator offline';
            backendCard.querySelector('.status-text').textContent = 'La API no responde.';
        }
    }

    logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${BACKEND_URL}/logout`, { credentials: 'include' });
            if (response.ok) {
                // Para desarrollo sin login, simplemente avisamos.
                // En producción, esto redirigiría a login.html
                alert("Sesión cerrada (simulado). En producción, serías redirigido.");
                // window.location.href = 'login.html';
            } else {
                throw new Error('Fallo al cerrar sesión.');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    function resetForm() {
        newsForm.reset();
        newsIdInput.value = '';
        formTitle.textContent = 'Crear Nueva Noticia';
        saveBtn.innerHTML = '<i class="fas fa-plus"></i> Crear Noticia';
        cancelBtn.style.display = 'none';
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        document.getElementById('date').valueAsDate = new Date();
    }

    function populateForm(newsId) {
        const item = currentNews.find(n => n.id === newsId);
        if (!item) return;

        formTitle.textContent = `Editando: ${item.title}`;
        newsIdInput.value = item.id;
        document.getElementById('title').value = item.title;
        document.getElementById('date').value = item.date.split(' ')[0]; // Tomar solo la parte YYYY-MM-DD
        document.getElementById('category').value = item.category;
        document.getElementById('icon').value = item.icon;
        document.getElementById('summary').value = item.summary;
        // Mostrar la imagen actual
        imagePreview.src = `${BACKEND_URL}${item.image}`;
        imagePreviewContainer.style.display = 'block';
        document.getElementById('link').value = item.link;
        document.getElementById('buttonText').value = item.buttonText;

        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        cancelBtn.style.display = 'inline-block';
    }

    newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = newsIdInput.value;
        const formData = new FormData(newsForm); // Usamos FormData para enviar archivos

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${BACKEND_URL}/api/news/update/${id}` : `${BACKEND_URL}/api/news/create`;

        // Si estamos editando y no se sube una nueva imagen, enviamos la ruta de la imagen actual
        if (id && !imageInput.files[0]) {
            const item = currentNews.find(n => n.id == id);
            formData.append('current_image_path', item.image);
        }

        try {
            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                body: formData // Enviamos el objeto FormData directamente
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            alert(result.message);
            resetForm();
            loadNews();

        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error(error);
        }
    });

    newsList.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-btn');
        const deleteButton = e.target.closest('.delete-btn');
        const itemInfo = e.target.closest('.item-info');

        if (editButton || itemInfo) {
            const id = parseInt((editButton || itemInfo).dataset.id);
            populateForm(id);
        }

        if (deleteButton) {
            const id = parseInt(deleteButton.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar esta noticia? Esta acción no se puede deshacer.')) {
                deleteNews(id);
            }
        }
    });

    async function deleteNews(id) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/news/delete/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            alert(result.message);
            loadNews();

        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error(error);
        }
    }

    addNewBtn.addEventListener('click', () => {
        resetForm();
    });

    cancelBtn.addEventListener('click', () => {
        resetForm();
    });

    const navItems = document.querySelectorAll('.admin-nav-item');
    const adminSections = document.querySelectorAll('.admin-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenir el comportamiento por defecto del enlace
            const targetId = item.dataset.target;

            // Detener la actualización del chat si cambiamos de pestaña
            if (chatPollInterval) {
                clearInterval(chatPollInterval);
                chatPollInterval = null; // Resetear la variable
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Si se hace clic en "Gestionar Chat", cargamos los mensajes
            if (targetId === 'chat-manager') {
                loadChatMessages();
                chatPollInterval = setInterval(loadChatMessages, 2000); // Actualiza cada 2 segundos
            } else if (targetId === 'downloads-manager') {
                loadDownloads();
            } else if (targetId === 'user-manager') {
                loadAllUsersForAdmin();
            } else if (targetId === 'dashboard-manager') {
                loadDashboardStats();
                loadAllUsersForAdmin();
            }

            adminSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Event listener para el botón de refrescar estado
    if (refreshStatusBtn) {
        refreshStatusBtn.addEventListener('click', checkSystemStatus);
    }

    // --- LÓGICA DEL GESTOR DE USUARIOS ---

    async function loadAllUsersForAdmin() {
        if (!userTableBody) return;
        userTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando usuarios...</td></tr>';
        try {
            // Esta ruta debe devolver todos los usuarios. Asumimos que ya existe en el backend.
            // Si no existe, hay que crearla en app.py
            const response = await fetch(`${BACKEND_URL}/api/admin/users`, { 
                credentials: 'include'
            });
            if (!response.ok) throw new Error('No se pudo obtener la lista de usuarios.');
    
            const users = await response.json();
            renderAdminUsersTable(users);
        } catch (error) {
            userTableBody.innerHTML = `<tr><td colspan="6" class="error-text" style="text-align:center;">${error.message}</td></tr>`;
        }
    }

    function renderAdminUsersTable(users) {
        userTableBody.innerHTML = '';
        const roles = ["Pico de madera", "Pico de Piedra", "Pico de Hierro", "Pico de Oro", "Pico de Diamante", "Pico de Netherite"];

        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.id;

            const roleOptions = roles.map(role => 
                `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`
            ).join('');

            row.innerHTML = `
                <td>${user.id}</td>
                <td>
                    <img src="${user.avatar_url || 'images/avatars/default-avatar.png'}" class="user-avatar-table">
                    ${user.username}
                </td>
                <td>
                    <select class="role-select">${roleOptions}</select>
                </td>
                <td>${new Date(user.registration_date).toLocaleDateString()}</td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" class="admin-checkbox" ${user.is_admin ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
                <td>
                    <button class="action-btn save-btn">Guardar</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    }

    userTableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-btn')) {
            const saveButton = event.target;
            const userRow = saveButton.closest('tr');
            const userId = userRow.dataset.userId;
            const roleSelect = userRow.querySelector('.role-select');
            const adminCheckbox = userRow.querySelector('.admin-checkbox');

            const newRole = roleSelect.value;
            const isAdmin = adminCheckbox.checked;

            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/update_user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ user_id: userId, role: newRole, is_admin: isAdmin }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error desconocido');
                alert('Usuario actualizado con éxito');
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = 'Guardar';
            }
        }
    });

    // --- LÓGICA DEL GESTOR DE CHAT ---

    async function loadChatMessages() {
        if (!adminChatView) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/chat/messages`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('No se pudieron cargar los mensajes.');
            const messages = await response.json();
            renderChatMessages(messages);
        } catch (error) {
            adminChatView.innerHTML = `<p style="color: var(--neon-pink);">${error.message}</p>`;
        }
    }

    function renderChatMessages(messages) {
        adminChatView.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${msg.username === 'Sistema' ? 'system' : 'user'}`;
            
            let contentHTML;
            if (msg.type === 'gif') {
                contentHTML = `<strong>${msg.username}:</strong><br><img src="${msg.content}" alt="GIF" class="chat-gif">`;
            } else {
                contentHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
            }

            msgDiv.innerHTML = `
                <p>${contentHTML}</p>
                <button class="delete-chat-btn" data-id="${msg.id}" title="Eliminar mensaje">&times;</button>
            `;
            adminChatView.appendChild(msgDiv);
        });
        // Auto-scroll al final
        adminChatView.scrollTop = adminChatView.scrollHeight;
    }

    // Enviar mensaje del sistema
    systemMessageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = systemMessageContent.value.trim();
        if (!content) return;

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // No necesita clave de admin para enviar como sistema desde el panel
                body: JSON.stringify({ username: 'Sistema', content: content, type: 'text' })
            });
            if (!response.ok) throw new Error('No se pudo enviar el mensaje.');
            
            alert('Mensaje del sistema enviado con éxito.');
            systemMessageContent.value = '';
            loadChatMessages(); // Recargar el chat para ver el nuevo mensaje
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // Eliminar un mensaje del chat desde el panel de admin
    adminChatView.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-chat-btn')) {
            const messageId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar este mensaje del chat?')) {
                try {
                    const response = await fetch(`${BACKEND_URL}/api/chat/messages/${messageId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    if (!response.ok) throw new Error('No se pudo eliminar el mensaje.');
                    
                    loadChatMessages(); // Recargar el chat silenciosamente
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        }
    });

    // Eliminar TODOS los mensajes del chat
    deleteAllChatBtn.addEventListener('click', async () => {
        if (confirm('¿ESTÁS COMPLETAMENTE SEGURO?\nEsta acción borrará permanentemente TODOS los mensajes del chat y no se puede deshacer.')) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/chat/messages/all`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'No se pudo limpiar el chat.');
                }
                
                loadChatMessages(); // Recargar la vista del chat, que ahora estará vacía.
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        }
    });

    // --- LÓGICA DEL GESTOR DE DESCARGAS ---

    async function loadDownloads() {
        if (!downloadsList) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/downloads`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('No se pudieron cargar las descargas.');
            const downloads = await response.json();
            renderDownloadsList(downloads);
        } catch (error) {
            downloadsList.innerHTML = `<p style="color: var(--neon-pink);">${error.message}</p>`;
        }
    }

    function renderDownloadsList(downloads) {
        downloadsList.innerHTML = '';
        if (downloads.length === 0) {
            downloadsList.innerHTML = '<p>No hay archivos de descarga configurados.</p>';
            return;
        }
        downloads.forEach(item => {
            const downloadItemDiv = document.createElement('div');
            downloadItemDiv.className = 'news-list-item';
            downloadItemDiv.innerHTML = `
                <div class="item-info">
                    <span class="item-date"><i class="${item.icon_class}"></i> ${item.platform}</span>
                    <span class="item-title">${item.version}</span>
                </div>
                <div class="item-actions">
                    <button class="delete-download-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            downloadsList.appendChild(downloadItemDiv);
        });
    }

    downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(downloadForm);
        const submitBtn = downloadForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        // Deshabilitar botón y mostrar indicador de subida
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

        try {
            const response = await fetch(`${BACKEND_URL}/api/downloads/create`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            alert(result.message);
            downloadForm.reset();
            loadDownloads();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            // Restaurar el botón a su estado original
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    downloadsList.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-download-btn')) {
            const btn = e.target.closest('.delete-download-btn');
            const downloadId = btn.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar este archivo de descarga? El archivo físico también será borrado del servidor.')) {
                deleteDownload(downloadId);
            }
        }
    });

    async function deleteDownload(id) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/downloads/delete/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            alert(result.message);
            loadDownloads(); // Recargar la lista para reflejar el cambio

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    // --- LÓGICA DEL ASISTENTE GEMINI ---

    function addMessageToGeminiChat(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('gemini-chat-message', sender);

        // Si es el asistente, añadimos el botón de copiar
        if (sender === 'assistant') {
            messageElement.innerHTML = `
                <p>${text}</p>
                <button class="copy-assistant-response-btn" title="Copiar respuesta"><i class="far fa-copy"></i></button>
            `;
        } else {
            messageElement.innerHTML = `<p>${text}</p>`; // Los mensajes de usuario no necesitan botón
        }

        geminiChatLog.appendChild(messageElement);
        geminiChatLog.scrollTop = geminiChatLog.scrollHeight;

        // Reproducir sonido de notificación
        if (notificationSound) {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.warn("No se pudo reproducir el sonido:", e));
        }
    }

    const geminiFileInput = document.getElementById('gemini-file-input');

    // --- Lógica del Asistente Gemini ---

    async function sendPromptToGemini(prompt, sectionContext = null) {
        const file = attachedFile;
        let userMessage = prompt;
        if (file) {
            userMessage += ` (Archivo adjunto: ${file.name})`;
        }

        // Si no hay prompt de texto pero sí un archivo, usa un prompt genérico
        if (!prompt && file) {
            userMessage = `Analiza el siguiente archivo: ${file.name}`;
            prompt = `Analiza el siguiente archivo.`;
        }

        addMessageToGeminiChat(userMessage, 'user'); // Muestra el mensaje del usuario en el DOM
        geminiChatInput.value = '';
        geminiFileInput.value = ''; // Limpiar el input de archivo
        toggleGeminiSendButton(); // Deshabilita el botón de enviar

        // Añade el mensaje del usuario al historial que enviaremos al backend
        geminiChatHistory.push({ role: 'user', parts: [{ text: prompt }] });
        clearAttachedFile(); // Limpiar el archivo después de añadirlo al mensaje

        addMessageToGeminiChat("Pensando...", 'assistant'); // Mensaje de carga
        
        const formData = new FormData();
        formData.append('history', JSON.stringify(geminiChatHistory));
        if (sectionContext) {
            formData.append('section', sectionContext);
        }
        if (file) {
            formData.append('file', file);
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini-chat`, {
                method: 'POST',
                credentials: 'include',
                body: formData // Enviar como FormData para soportar archivos
            });
            const data = await response.json();
            
            // Reemplazar el mensaje de "Pensando..." con la respuesta real
            const loadingMessage = geminiChatLog.querySelector('.assistant:last-child');
            if (loadingMessage) loadingMessage.querySelector('p').textContent = data.answer;
            // Añade la respuesta del asistente al historial para la siguiente pregunta
            geminiChatHistory.push({ role: 'model', parts: [{ text: data.answer }] });

        } catch (error) {
            const loadingMessage = geminiChatLog.querySelector('.assistant:last-child');
            if (loadingMessage) loadingMessage.querySelector('p').textContent = "Error de conexión con el asistente. Inténtalo de nuevo.";
            console.error("Error en el chat de Gemini:", error);
        }
    }

    // --- Lógica para reiniciar la conversación con Gemini ---
    geminiResetBtn.addEventListener('click', () => {
        // Limpiar el historial y el DOM
        geminiChatLog.innerHTML = '';
        geminiChatHistory = [];

        // Obtener la sección actual que está almacenada en el dataset del log
        const currentSection = geminiChatLog.dataset.currentSection || 'general';

        // Mostrar de nuevo el mensaje de bienvenida
        addMessageToGeminiChat(`Hola, soy tu asistente de GLauncher. ¿En qué puedo ayudarte con la sección de ${currentSection.replace('-', ' ').toUpperCase()}?`, 'assistant');
        geminiChatInput.focus();
    });

    // --- Lógica para cerrar el modal ---
    geminiWidgetClose.addEventListener('click', () => {
        geminiChatWidget.classList.remove('visible');
    });


    // --- Lógica para enviar el formulario del chat de Gemini ---
    geminiChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userPrompt = geminiChatInput.value.trim();
        const currentSection = geminiChatLog.dataset.currentSection; // Get section context
        // Enviar si hay texto o si hay un archivo adjunto
        if (userPrompt || attachedFile) {
            sendPromptToGemini(userPrompt, currentSection);
        }
    });

    // Deshabilitar el botón de enviar de Gemini si el input está vacío
    const geminiSendBtn = geminiChatForm.querySelector('.gemini-chat-send-btn');
    function toggleGeminiSendButton() {
        // Habilitar si hay texto o un archivo adjunto
        geminiSendBtn.disabled = geminiChatInput.value.trim() === '' && !attachedFile;
    }
    geminiChatInput.addEventListener('input', toggleGeminiSendButton);
    toggleGeminiSendButton(); // Estado inicial

    // --- Lógica para copiar la respuesta del asistente ---
    geminiChatLog.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-assistant-response-btn');
        if (copyBtn) {
            const messageText = copyBtn.previousElementSibling.textContent;
            navigator.clipboard.writeText(messageText).then(() => {
                const icon = copyBtn.querySelector('i');
                icon.classList.remove('fa-copy');
                icon.classList.add('fa-check');
                copyBtn.title = "¡Copiado!";
                setTimeout(() => {
                    icon.classList.remove('fa-check');
                    icon.classList.add('fa-copy');
                    copyBtn.title = "Copiar respuesta";
                }, 2000); // Vuelve al icono original después de 2 segundos
            }).catch(err => console.error('Error al copiar:', err));
        }
    });

    // --- Lógica del panel de emojis para Gemini ---
    geminiEmojiBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        geminiPickerContainer.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
        const isClickInsidePicker = geminiPickerContainer.contains(event.target);
        const isClickOnEmojiButton = geminiEmojiBtn.contains(event.target);
        if (!isClickInsidePicker && !isClickOnEmojiButton) {
            geminiPickerContainer.classList.remove('show');
        }
    });

    const emojiPicker = document.querySelector('#gemini-picker-container emoji-picker');
    if (emojiPicker) {
        emojiPicker.addEventListener('emoji-click', event => {
            geminiChatInput.value += event.detail.unicode;
            geminiChatInput.focus();
        });
    }

    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            imagePreview.src = URL.createObjectURL(file);
            imagePreviewContainer.style.display = 'block';
        }
    });

    // --- Lógica para el botón flotante del asistente (CORREGIDO Y MEJORADO) ---
    floatingGeminiBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic se propague al documento
        const isVisible = geminiChatWidget.classList.toggle('visible');

        if (isVisible) {
            // Obtener la sección activa actualmente
            const activeSection = document.querySelector('.admin-section.active');
            const sectionId = activeSection ? activeSection.id.replace('-manager', '') : 'general';

            // Solo muestra el mensaje de bienvenida si el chat está vacío
            if (geminiChatLog.children.length === 0) {
                addMessageToGeminiChat(`Hola, soy tu asistente. ¿En qué puedo ayudarte con la sección de ${sectionId.replace('-', ' ').toUpperCase()}?`, 'assistant');
            }
            // Siempre actualiza el contexto
            geminiChatLog.dataset.currentSection = sectionId;
        }
    });

    // --- Lógica para adjuntar y previsualizar archivos ---
    function handleFileAttachment(file) {
        if (!file) return;
        attachedFile = file;
        filePreviewText.textContent = `Adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        filePreviewContainer.style.display = 'flex';
        toggleGeminiSendButton();
    }

    function clearAttachedFile() {
        attachedFile = null;
        geminiFileInput.value = ''; // Resetea el input de archivo
        filePreviewContainer.style.display = 'none';
        toggleGeminiSendButton();
    }

    geminiFileInput.addEventListener('change', () => {
        handleFileAttachment(geminiFileInput.files[0]);
    });

    removeFileBtn.addEventListener('click', clearAttachedFile);

    // --- Lógica para la grabación de audio ---
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], "grabacion.webm", { type: 'audio/webm' });
                handleFileAttachment(audioFile);
                // Detener los tracks del stream para apagar el indicador del navegador
                stream.getTracks().forEach(track => track.stop());
            });

            geminiMicBtn.classList.add('recording');
            geminiMicBtn.title = "Detener grabación";
            geminiMicBtn.querySelector('i').className = 'fas fa-stop';

        } catch (err) {
            console.error("Error al acceder al micrófono:", err);
            alert("No se pudo acceder al micrófono. Asegúrate de haber dado los permisos necesarios.");
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            geminiMicBtn.classList.remove('recording');
            geminiMicBtn.title = "Grabar audio";
            geminiMicBtn.querySelector('i').className = 'fas fa-microphone';
        }
    }

    geminiMicBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            stopRecording();
        } else {
            // Si hay un archivo adjunto, pregunta antes de grabar
            if (attachedFile) {
                if (confirm("Ya tienes un archivo adjunto. ¿Quieres reemplazarlo con una grabación de audio?")) {
                    clearAttachedFile();
                    startRecording();
                }
            } else {
                startRecording();
            }
        }
    });

    // --- Lógica para los botones de sugerencia de prompt ---
    document.querySelectorAll('.prompt-suggestion-btn').forEach(button => {
        button.addEventListener('click', () => {
            geminiChatInput.value = button.dataset.prompt;
            geminiChatInput.focus();
            toggleGeminiSendButton();
        });
    });
    
    // Cargar contenido inicial del panel
    loadDashboardStats();
    checkSystemStatus();
    loadNews();
});