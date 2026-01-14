document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username_login');
    const passwordInput = document.getElementById('password_login');
    const togglePassword = document.getElementById('toggle-password-login');

    // Ocultar la sección de código de seguridad por si aún existe en el HTML
    const codeEntrySection = document.getElementById('code-entry-section');
    if (codeEntrySection) {
        codeEntrySection.style.display = 'none';
    }

    if (loginForm) {
        // --- Proceso de Login en un solo paso ---
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evitar envío tradicional

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                window.showNotification('Por favor, ingresa tu usuario y contraseña.', 'error');
                return;
            }

            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accediendo...';

            try {
                // Llamada al endpoint de login simplificado
                const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // ¡Éxito! Guardar token y redirigir
                    localStorage.setItem('glauncher_token', data.token);
                    localStorage.setItem('glauncher_username', data.username);

                    window.showNotification('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);

                } else {
                    // Mostrar error del backend
                    throw new Error(data.message || 'Error en el inicio de sesión.');
                }

            } catch (error) {
                window.showNotification(error.message, 'error');
                // Reactivar botón en caso de fallo
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
            }
        });
    }

    // --- Lógica para mostrar/ocultar contraseña ---
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }
    
    // --- Lógica para el formulario de "Olvidé mi contraseña" (solo UI) ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const cancelResetLink = document.getElementById('cancel-reset-link');
    const authContainer = document.querySelector('.auth-container');

    if (forgotPasswordLink && resetPasswordForm && authContainer && cancelResetLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            authContainer.querySelector('#login-form').style.display = 'none';
            authContainer.querySelector('.social-login-options').style.display = 'none';
            authContainer.querySelector('.auth-footer-text').style.display = 'none';
            resetPasswordForm.style.display = 'block';
        });

        cancelResetLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetPasswordForm.style.display = 'none';
            authContainer.querySelector('#login-form').style.display = 'block';
            authContainer.querySelector('.social-login-options').style.display = 'block';
            authContainer.querySelector('.auth-footer-text').style.display = 'block';
        });
    }
});
