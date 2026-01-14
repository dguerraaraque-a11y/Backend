document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://glauncher-api.onrender.com';
    const token = localStorage.getItem('glauncher_token');

    const gcoinBalanceContainer = document.getElementById('user-gcoin-balance');
    const gcoinAmountSpan = document.getElementById('gcoin-amount');
    const dailyRewardSection = document.getElementById('daily-reward-section');
    const cosmeticsGrid = document.getElementById('cosmetics-grid');
    let userOwnedCosmetics = [];

    // Función para actualizar el saldo de GCoins en la UI
    function updateGcoinBalance(amount) {
        if (gcoinAmountSpan) {
            gcoinAmountSpan.innerHTML = `${amount.toLocaleString('es-ES')} <i class="fas fa-coins"></i>`;
        }
    }

    // Función para renderizar los ítems de la tienda
    function renderShopItems(items) {
        if (!cosmeticsGrid) return;
        cosmeticsGrid.innerHTML = ''; // Limpiar la tienda

        if (items.length === 0) {
            cosmeticsGrid.innerHTML = '<p>La tienda se está reabasteciendo. ¡Vuelve más tarde!</p>';
            return;
        }

        items.forEach(item => {
            const isOwned = userOwnedCosmetics.includes(item.id);
            const itemElement = document.createElement('div');
            itemElement.className = 'cosmetic-item';
            if (isOwned) {
                itemElement.classList.add('owned');
            }

            itemElement.innerHTML = `
                <div class="item-preview" style="background-image: url('${BACKEND_URL}${item.image_url}');">
                    <div class="item-rarity ${item.rarity}">${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}</div>
                    ${isOwned ? '<div class="owned-badge"><i class="fas fa-check-circle"></i> Adquirido</div>' : ''}
                </div>
                <div class="item-info">
                    <h4 class="item-name">${item.name}</h4>
                    <p class="item-description">${item.description}</p>
                    <div class="item-price">${item.price.toLocaleString('es-ES')} <i class="fas fa-coins"></i></div>
                    <button class="action-btn buy-btn" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}" ${isOwned ? 'disabled' : ''}>
                        ${isOwned ? 'Adquirido' : '<i class="fas fa-lock-open"></i> Desbloquear'}
                    </button>
                </div>
            `;
            cosmeticsGrid.appendChild(itemElement);
        });

        // Añadir listeners a los nuevos botones de compra
        document.querySelectorAll('.cosmetic-item .buy-btn:not([disabled])').forEach(button => {
            button.addEventListener('click', handlePurchase);
        });
    }

    // Función para manejar la compra
    async function handlePurchase(event) {
        if (!token) {
            window.showNotification('Debes iniciar sesión para comprar artículos.', 'error');
            return;
        }

        const button = event.currentTarget;
        const itemId = button.dataset.itemId;
        const itemName = button.dataset.itemName;
        const itemPrice = button.dataset.itemPrice;

        if (confirm(`¿Seguro que quieres comprar "${itemName}" por ${itemPrice} GCoins?`)) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(`${BACKEND_URL}/api/shop/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ item_id: itemId })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                window.showNotification(data.message, 'success');
                updateGcoinBalance(data.new_balance);
                userOwnedCosmetics.push(parseInt(itemId)); // Actualizar localmente
                loadShopItems(); // Recargar la tienda para mostrar el estado "Adquirido"

            } catch (error) {
                window.showNotification(error.message, 'error');
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-lock-open"></i> Desbloquear';
            }
        }
    }

    // Función para cargar los ítems de la tienda desde el backend
    async function loadShopItems() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/shop/items`);
            if (!response.ok) {
                throw new Error('No se pudieron cargar los artículos de la tienda.');
            }
            const items = await response.json();
            renderShopItems(items);
        } catch (error) {
            if (cosmeticsGrid) {
                cosmeticsGrid.innerHTML = `<p class="error-text">${error.message}</p>`;
            }
            console.error(error);
        }
    }

    // Función para gestionar la recompensa diaria
    function setupDailyReward(user) {
        if (!dailyRewardSection) return;

        const now = new Date();
        const lastClaim = user.last_daily_reward_claim ? new Date(user.last_daily_reward_claim) : null;
        
        let canClaim = true;
        let timeRemaining = 0;

        if (lastClaim) {
            const diffSeconds = (now.getTime() - lastClaim.getTime()) / 1000;
            if (diffSeconds < 86400) { // 24 horas
                canClaim = false;
                timeRemaining = 86400 - diffSeconds;
            }
        }

        if (canClaim) {
            dailyRewardSection.innerHTML = `
                <p>¡Tu recompensa diaria está lista!</p>
                <button id="claim-reward-btn" class="action-btn buy-btn">Reclamar 50 <i class="fas fa-coins"></i></button>
            `;
            dailyRewardSection.style.display = 'block';

            const claimBtn = document.getElementById('claim-reward-btn');
            claimBtn.addEventListener('click', async () => {
                claimBtn.disabled = true;
                claimBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reclamando...';

                try {
                    const response = await fetch(`${BACKEND_URL}/api/shop/claim_daily_reward`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();

                    if (response.ok) {
                        window.showNotification(data.message, 'success');
                        updateGcoinBalance(data.new_balance);
                        dailyRewardSection.style.display = 'none'; // Ocultar sección después de reclamar
                    } else {
                        throw new Error(data.message || 'No se pudo reclamar la recompensa.');
                    }
                } catch (error) {
                    window.showNotification(error.message, 'error');
                    claimBtn.disabled = false;
                    claimBtn.innerHTML = 'Reclamar 50 <i class="fas fa-coins"></i>';
                }
            });
        }
    }

    // Cargar información del usuario si está logueado
    if (token) {
        fetch(`${BACKEND_URL}/api/user_info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                // Token inválido o expirado, no mostramos nada.
                console.warn(data.error);
                return;
            }
            // Mostrar saldo y configurar recompensa
            gcoinBalanceContainer.style.display = 'block';
            updateGcoinBalance(data.gcoins);
            userOwnedCosmetics = data.owned_cosmetics || [];
            loadShopItems(); // Recargar items ahora que sabemos cuáles posee el usuario
            setupDailyReward(data); // Pasamos el objeto de usuario
        })
        .catch(error => console.error('Error al obtener datos del usuario:', error));
    }

    // Cargar los ítems de la tienda al iniciar la página
    loadShopItems();
});