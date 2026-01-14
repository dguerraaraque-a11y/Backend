/**
 * GLAUNCHER - Global UI & Functionality Script
 */
document.addEventListener('DOMContentLoaded', () => {

    // ========================================================
    // 0. LÓGICA DEL BANNER DE COOKIES
    // ========================================================
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookieBtn = document.getElementById('accept-cookie-btn');

    if (!localStorage.getItem('glauncher_cookies_accepted')) {
        cookieBanner?.classList.add('visible');
    }

    acceptCookieBtn?.addEventListener('click', () => {
        localStorage.setItem('glauncher_cookies_accepted', 'true');
        cookieBanner.classList.remove('visible');
    });

    // ========================================================
    // 1. SISTEMA DE CARGA, NOTIFICACIONES Y OFFLINE
    // ========================================================
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        window.addEventListener('load', () => {
            loader.classList.add('hidden');
            setTimeout(() => { loader.remove(); }, 500);
        });
    }

    const offlineOverlay = document.getElementById('offline-overlay');
    const updateOnlineStatus = () => {
        offlineOverlay?.classList.toggle('visible', !navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    window.showNotification = (message, type = 'info') => {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
        notification.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;
        container.appendChild(notification);
        setTimeout(() => { notification.remove(); }, 5000);
    };

    // ========================================================
    // 2. LÓGICA DE INICIO DE SESIÓN SOCIAL (POP-UP)
    // ========================================================
    const handleSocialLogin = (event) => {
        event.preventDefault(); // Evitar la redirección estándar

        const authUrl = event.currentTarget.href;
        const windowName = 'GLauncherSocialAuth';
        const windowFeatures = 'width=600,height=700,top=100,left=100';

        const authWindow = window.open(authUrl, windowName, windowFeatures);

        // Escuchar mensajes de la ventana pop-up
        const handleAuthMessage = (messageEvent) => {
            // Asegurarse de que el mensaje viene de la misma ventana que abrimos
            if (messageEvent.source !== authWindow) return;

            const { type, token, message } = messageEvent.data;

            if (type === 'social-login-success' && token) {
                // Guardar el token
                localStorage.setItem('glauncher_token', token);
                
                // Opcional: decodificar el token para obtener el nombre de usuario sin hacer otra llamada
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    if (payload.username) {
                        localStorage.setItem('glauncher_username', payload.username);
                    }
                } catch (e) {
                    console.error('Error decodificando el token JWT:', e);
                }

                window.showNotification('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);

            } else if (type === 'social-login-error') {
                window.showNotification(message || 'Falló el inicio de sesión social.', 'error');
            }
            
            // Limpiar el listener para evitar duplicados
            window.removeEventListener('message', handleAuthMessage);
        };
        
        window.addEventListener('message', handleAuthMessage);
    };

    document.querySelectorAll('a.social-login-button').forEach(button => {
        button.addEventListener('click', handleSocialLogin);
    });
    
    // ========================================================
    // 3. EFECTOS DE SONIDO GLOBALES (debe estar después de otros listeners de clic si es necesario)
    // ========================================================
    const clickSound = new Audio('sounds/ui_click.mp3');
    clickSound.preload = 'auto';
    clickSound.volume = 0.3;

    const playClickSound = () => {
        clickSound.currentTime = 0;
        clickSound.play().catch(error => console.warn("No se pudo reproducir el sonido de clic:", error));
    };

    const clickableElements = document.querySelectorAll(`
        .auth-button, .download-button, .auth-button-action, .filter-button, .prog-tab-button, .tab-button, .control-button
    `);
    clickableElements.forEach(element => {
        element.addEventListener('click', playClickSound);
    });
    
    // Se añade .social-login-button aquí por si no se previene el comportamiento por defecto (backup)
    document.querySelectorAll('.social-login-button').forEach(button => {
        button.addEventListener('click', playClickSound);
    });

});
