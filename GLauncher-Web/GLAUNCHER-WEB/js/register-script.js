document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const confirmPassword = document.getElementById('confirm-password').value.trim();

            if (!username || !password) {
                window.showNotification('El nombre de usuario y la contraseña no pueden estar vacíos.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                window.showNotification('Las contraseñas no coinciden.', 'error');
                return;
            }
            
            // El objeto de datos ahora solo incluye username y password
            const userData = { username, password };

            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

            try {
                const response = await fetch(`${BACKEND_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    window.showNotification(result.message, 'success');
                    setTimeout(() => {
                        window.location.href = "login.html?status=registered";
                    }, 2000);
                } else {
                    throw new Error(result.message || 'Error desconocido durante el registro.');
                }
            } catch (error) {
                window.showNotification(error.message, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-rocket"></i> Registrar y Jugar';
            }
        });
    }
});
