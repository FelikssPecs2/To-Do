let currentUser = null;
let products = [];
let warehouseLocations = [];
let users = [];

async function api(url, method = 'GET', data = null) {
    const options = {
        method,
        credentials: 'same-origin',
        headers: {}
    };

    if (data !== null) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || 'Radās kļūda');
    }

    return result;
}

function showMessage(message, type = 'success') {
    const element = document.getElementById('message');
    element.textContent = message;
    element.className = `message ${type}`;

    setTimeout(() => {
        element.className = 'message';
        element.textContent = '';
    }, 4000);
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

function roleNames(role) {
    const names = {
        admin: 'Administrators',
        worker: 'Darbinieks',
        organizer: 'Šķirotājs'
    };

    return names[role] || role;
}

async function loadUser() {
    const result = await api('api/auth.php?action=me');

    if (!result.user) {
        location.href = 'login.html';
        return false;
    }

    currentUser = result.user;
    document.getElementById('user-name').textContent =
        `${currentUser.name} (${roleNames(currentUser.role)})`;

    applyPermissions();
    return true;
}

function applyPermissions() {
    const isAdmin = currentUser.role === 'admin';
    const isOrganizer = currentUser.role === 'organizer';

    document.getElementById('product-form-panel').hidden = isOrganizer;
    document.getElementById('location-form-panel').hidden = !isAdmin;
    document.getElementById('location-assignment-panel').hidden =
        currentUser.role !== 'admin' && currentUser.role !== 'organizer';
    document.getElementById('order-form-panel').hidden = isOrganizer;
    document.getElementById('product-actions-heading').hidden = isOrganizer;
    document.getElementById('report-orders-panel').hidden = isOrganizer;
    document.getElementById('report-movements-panel').hidden = isOrganizer;
    document.querySelector('[data-section="orders"]').hidden = isOrganizer;
    document.querySelector('[data-section="reports"]').hidden = false;
    document.getElementById('users-nav-button').hidden = !isAdmin;
}

function initializeNavigation() {
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-button').forEach(item => {
                item.classList.remove('active');
            });

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            button.classList.add('active');
            const section = document.getElementById(`${button.dataset.section}-section`);

            if (section) {
                section.classList.add('active');
            }
        });
    });
}

async function loadProducts() {
    const result = await api('api/products.php');
    products = result.products || [];

    const locationProduct = document.getElementById('location-product');
    locationProduct.innerHTML = '<option value="">Izvēlies produktu</option>';

    products.filter(product => product.status === 'active').forEach(product => {
        locationProduct.innerHTML += `
            <option value="${Number(product.id)}">${escapeHTML(product.name)}</option>
        `;
    });

    const table = document.getElementById('products-table');

    if (products.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="empty-state">Nav produktu</td></tr>';
    } else {
        table.innerHTML = products.map(product => `
            <tr>
                <td>${escapeHTML(product.name)}</td>
                <td>${escapeHTML(product.sku)}</td>
                <td>${escapeHTML(product.quantity)}</td>
                <td>${Number(product.price).toFixed(2)} €</td>
                <td><span class="status ${product.status === 'active' ? 'status-active' : 'status-inactive'}">${product.status === 'active' ? 'Aktīvs' : 'Neaktīvs'}</span></td>
                <td ${currentUser.role === 'organizer' ? 'hidden' : ''}>
                    ${currentUser.role !== 'organizer' ? `
                        <button class="action-button edit-button" onclick="editProduct(${Number(product.id)})">Labot</button>
                        ${currentUser.role === 'admin' ? `<button class="action-button delete-button" onclick="deleteProduct(${Number(product.id)})">Dzēst</button>` : ''}
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    const select = document.getElementById('order-product');
    select.innerHTML = '<option value="">Izvēlies produktu</option>';

    products.filter(product => product.status === 'active').forEach(product => {
        select.innerHTML += `
            <option value="${Number(product.id)}">${escapeHTML(product.name)} (${escapeHTML(product.quantity)} gab.)</option>
        `;
    });
}

document.getElementById('product-form').addEventListener('submit', async event => {
    event.preventDefault();

    const id = document.getElementById('product-id').value;
    const data = {
        name: document.getElementById('product-name').value.trim(),
        sku: document.getElementById('product-sku').value.trim(),
        quantity: Number(document.getElementById('product-quantity').value),
        price: Number(document.getElementById('product-price').value),
        description: document.getElementById('product-description').value.trim()
    };

    try {
        await api('api/products.php', id ? 'PUT' : 'POST', id ? { ...data, id: Number(id) } : data);
        showMessage(id ? 'Produkts veiksmīgi atjaunots!' : 'Produkts veiksmīgi pievienots!');
        resetProductForm();
        await Promise.all([loadProducts(), loadReports()]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

function editProduct(id) {
    const product = products.find(item => Number(item.id) === id);
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-sku').value = product.sku;
    document.getElementById('product-quantity').value = product.quantity;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-form-title').textContent = 'Labot produktu';
    document.getElementById('product-submit').textContent = 'Saglabāt izmaiņas';
    document.getElementById('product-cancel').hidden = false;
    document.getElementById('product-form-panel').scrollIntoView({ behavior: 'smooth' });
}

function resetProductForm() {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-form-title').textContent = 'Pievienot produktu';
    document.getElementById('product-submit').textContent = 'Pievienot produktu';
    document.getElementById('product-cancel').hidden = true;
}

document.getElementById('product-cancel').addEventListener('click', resetProductForm);

async function deleteProduct(id) {
    if (!confirm('Vai tiešām vēlies dzēst šo produktu?')) return;

    try {
        await api('api/products.php', 'DELETE', { id });
        showMessage('Produkts veiksmīgi dzēsts!');
        await Promise.all([loadProducts(), loadReports()]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function loadLocations() {
    const result = await api('api/locations.php');
    const locations = result.locations || [];
    warehouseLocations = locations;
    const table = document.getElementById('locations-table');

    if (locations.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="empty-state">Nav pieejamu atrašanās vietu</td></tr>';
    } else {
        table.innerHTML = locations.map(location => `
            <tr>
                <td>${location.product_name ? escapeHTML(location.product_name) : 'Nav produkta'}</td>
                <td>${escapeHTML(location.zone)}</td>
                <td>${escapeHTML(location.shelf)}</td>
                <td>${escapeHTML(location.quantity)}</td>
            </tr>
        `).join('');
    }

    const locationSelect = document.getElementById('location-select');
    const uniqueLocations = [...new Map(locations.map(location => [location.location_id, location])).values()];
    locationSelect.innerHTML = '<option value="">Izvēlies plauktu</option>';

    uniqueLocations.forEach(location => {
        locationSelect.innerHTML += `
            <option value="${Number(location.location_id)}">${escapeHTML(location.zone)} - ${escapeHTML(location.shelf)}</option>
        `;
    });
}

document.getElementById('location-assignment-form').addEventListener('submit', async event => {
    event.preventDefault();

    const data = {
        product_id: Number(document.getElementById('location-product').value),
        location_id: Number(document.getElementById('location-select').value),
        quantity: Number(document.getElementById('location-quantity').value)
    };

    try {
        await api('api/locations.php', 'PUT', data);
        showMessage('Produkts pievienots atrašanās vietai!');
        document.getElementById('location-assignment-form').reset();
        await Promise.all([loadLocations(), loadReports()]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

document.getElementById('location-form').addEventListener('submit', async event => {
    event.preventDefault();

    const data = {
        zone: document.getElementById('location-zone').value.trim(),
        shelf: document.getElementById('location-shelf').value.trim(),
        description: document.getElementById('location-description').value.trim()
    };

    try {
        await api('api/locations.php', 'POST', data);
        showMessage('Plaukts veiksmīgi pievienots!');
        document.getElementById('location-form').reset();
        await loadLocations();
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

async function loadOrders() {
    if (currentUser.role === 'organizer') return;

    const result = await api('api/orders.php');
    const orders = result.orders || [];
    const table = document.getElementById('orders-table');

    if (orders.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="empty-state">Nav pasūtījumu</td></tr>';
        return;
    }

    const statusNames = {
        pending: 'Gaida',
        processing: 'Apstrādē',
        completed: 'Pabeigts',
        cancelled: 'Atcelts'
    };

    table.innerHTML = orders.map(order => `
        <tr>
            <td>${escapeHTML(order.order_number)}</td>
            <td>
                ${currentUser.role === 'admin' || currentUser.role === 'worker' ? `
                    <select class="status-select" onchange="changeOrderStatus(${Number(order.id)}, this.value)">
                        ${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                ` : `<span class="status status-${escapeHTML(order.status)}">${statusNames[order.status] || escapeHTML(order.status)}</span>`}
            </td>
            <td>${escapeHTML(order.created_by_name || order.created_by || '')}</td>
            <td>${escapeHTML(order.created_at || '')}</td>
            <td>${currentUser.role === 'admin' ? `<button class="action-button delete-button" onclick="deleteOrder(${Number(order.id)})">Dzēst</button>` : ''}</td>
        </tr>
    `).join('');
}

document.getElementById('order-form').addEventListener('submit', async event => {
    event.preventDefault();

    const productId = Number(document.getElementById('order-product').value);
    const quantity = Number(document.getElementById('order-quantity').value);

    if (!productId || quantity < 1) {
        showMessage('Izvēlies produktu un norādi derīgu daudzumu.', 'error');
        return;
    }

    try {
        await api('api/orders.php', 'POST', {
            items: [{ product_id: productId, quantity }],
            notes: document.getElementById('order-notes').value.trim()
        });

        showMessage('Pasūtījums veiksmīgi izveidots!');
        document.getElementById('order-form').reset();
        await Promise.all([loadOrders(), loadReports()]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

async function changeOrderStatus(id, status) {
    try {
        await api('api/orders.php', 'PUT', { id, status });
        showMessage('Pasūtījuma statuss atjaunots!');
        await loadReports();
    } catch (error) {
        showMessage(error.message, 'error');
        await loadOrders();
    }
}

async function deleteOrder(id) {
    if (!confirm('Vai tiešām vēlies dzēst šo pasūtījumu?')) return;

    try {
        await api('api/orders.php', 'DELETE', { id });
        showMessage('Pasūtījums veiksmīgi dzēsts!');
        await Promise.all([loadOrders(), loadReports()]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function loadUsers() {
    if (currentUser.role !== 'admin') return;

    const result = await api('api/users.php');
    users = result.users || [];
    const table = document.getElementById('users-table');

    if (users.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="empty-state">Nav reģistrētu lietotāju</td></tr>';
        return;
    }

    table.innerHTML = users.map(user => {
        const isCurrentUser = Number(user.id) === Number(currentUser.id);
        const date = user.created_at
            ? new Date(user.created_at.replace(' ', 'T')).toLocaleString('lv-LV')
            : '';

        return `
            <tr>
                <td>${escapeHTML(user.name)}</td>
                <td>${escapeHTML(user.email)}</td>
                <td>
                    ${isCurrentUser
                        ? escapeHTML(roleNames(user.role))
                        : `
                            <select class="role-select" onchange="changeUserRole(${Number(user.id)}, this.value)">
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrators</option>
                                <option value="worker" ${user.role === 'worker' ? 'selected' : ''}>Darbinieks</option>
                                <option value="organizer" ${user.role === 'organizer' ? 'selected' : ''}>Šķirotājs</option>
                            </select>
                        `}
                </td>
                <td>${escapeHTML(date)}</td>
                <td>
                    ${isCurrentUser
                        ? '<span>Pašreizējais konts</span>'
                        : `<button class="action-button delete-button" onclick="deleteUser(${Number(user.id)})">Dzēst</button>`}
                </td>
            </tr>
        `;
    }).join('');
}

async function changeUserRole(id, role) {
    const user = users.find(item => Number(item.id) === Number(id));

    if (!user || !['admin', 'worker', 'organizer'].includes(role)) return;
    if (user.role === role) return;

    if (!confirm(`Vai tiešām vēlies mainīt lietotāja "${user.name}" lomu uz "${roleNames(role)}"?`)) {
        await loadUsers();
        return;
    }

    try {
        await api('api/users.php', 'PUT', { id, role });
        showMessage('Lietotāja loma veiksmīgi nomainīta!');
        await loadUsers();
    } catch (error) {
        showMessage(error.message, 'error');
        await loadUsers();
    }
}

async function deleteUser(id) {
    const user = users.find(item => Number(item.id) === Number(id));

    if (!user) return;
    if (!confirm(`Vai tiešām vēlies izdzēst lietotāja "${user.name}" kontu?`)) return;

    try {
        await api('api/users.php', 'DELETE', { id });
        showMessage('Lietotāja konts veiksmīgi izdzēsts!');
        await loadUsers();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function loadReports() {
    const result = await api('api/reports.php');
    const productStats = result.products || {};
    const orderStats = result.orders || {};

    document.getElementById('total-products').textContent = productStats.total_products || 0;
    document.getElementById('total-quantity').textContent = productStats.total_quantity || 0;
    document.getElementById('active-products').textContent = productStats.active_products || 0;
    document.getElementById('inactive-products').textContent = productStats.inactive_products || 0;
    document.getElementById('total-orders').textContent = orderStats.total_orders || 0;

    const stock = result.stock || [];
    const stockStatusNames = {
        active: 'Aktīvs',
        inactive: 'Neaktīvs'
    };

    document.getElementById('report-stock').innerHTML = stock.length
        ? stock.map(item => `
            <tr>
                <td>${escapeHTML(item.name)}</td>
                <td>${escapeHTML(item.sku)}</td>
                <td>${escapeHTML(item.quantity)}</td>
                <td>
                    <span class="status ${item.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${stockStatusNames[item.status] || escapeHTML(item.status)}
                    </span>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty-state">Nav produktu datu</td></tr>';

    const locations = result.locations || [];
    document.getElementById('report-locations').innerHTML = locations.length
        ? locations.map(item => `
            <tr>
                <td>${escapeHTML(item.zone)}</td>
                <td>${escapeHTML(item.shelf)}</td>
                <td>${escapeHTML(item.quantity)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" class="empty-state">Nav atrašanās vietu datu</td></tr>';

    document.getElementById('report-pending').textContent = orderStats.pending_orders || 0;
    document.getElementById('report-processing').textContent = orderStats.processing_orders || 0;
    document.getElementById('report-completed').textContent = orderStats.completed_orders || 0;
    document.getElementById('report-cancelled').textContent = orderStats.cancelled_orders || 0;

    const movements = result.stock_movements || [];
    const movementNames = {
        in: 'Ienākošā kustība',
        out: 'Izejošā kustība',
        adjustment: 'Korekcija'
    };

    document.getElementById('report-movements').innerHTML = movements.length
        ? movements.map(item => `
            <tr>
                <td>${escapeHTML(item.product_name)}</td>
                <td>${movementNames[item.movement_type] || escapeHTML(item.movement_type)}</td>
                <td>${escapeHTML(item.quantity)}</td>
                <td>${escapeHTML(item.user_name || 'Dzēsts lietotājs')}</td>
                <td>${escapeHTML(item.created_at || '')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" class="empty-state">Nav produktu kustību</td></tr>';

    const locationStock = result.location_stock || [];
    document.getElementById('overview-stock').innerHTML = locationStock.length
        ? locationStock.map(item => `
            <tr>
                <td>${item.product_name ? escapeHTML(item.product_name) : 'Nav produkta'}</td>
                <td>${escapeHTML(item.zone)}</td>
                <td>${escapeHTML(item.shelf)}</td>
                <td>${escapeHTML(item.quantity)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty-state">Nav pieejamu datu</td></tr>';
}

function initializeReportPrinting() {
    const printStyles = document.createElement('style');

    printStyles.textContent = `
        @media print {
            @page {
                size: A4 landscape;
                margin: 12mm;
            }

            body * {
                visibility: hidden !important;
            }

            #reports-section,
            #reports-section * {
                visibility: visible !important;
            }

            #reports-section {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
            }

            #generate-report-button,
            .warehouse-sidebar,
            .warehouse-header,
            .nav,
            #message {
                display: none !important;
            }

            #reports-section .panel {
                display: block !important;
                break-inside: avoid;
                page-break-inside: avoid;
                box-shadow: none !important;
                border: 1px solid #dddddd !important;
                margin-bottom: 12px !important;
            }

            #reports-section table {
                width: 100% !important;
                border-collapse: collapse !important;
            }

            #reports-section th,
            #reports-section td {
                border: 1px solid #dddddd !important;
                padding: 7px !important;
                color: #000000 !important;
            }

            #reports-section th {
                background: #eeeeee !important;
            }

            #reports-section .status {
                color: #000000 !important;
                background: transparent !important;
            }

            #report-generated-at {
                color: #333333 !important;
                font-size: 12px !important;
            }
        }
    `;

    document.head.appendChild(printStyles);
}

async function generateReport() {
    const button = document.getElementById('generate-report-button');

    try {
        button.disabled = true;
        button.textContent = 'Sagatavo pārskatu...';

        await loadReports();

        const now = new Date();
        const formattedDate = now.toLocaleString('lv-LV');

        document.getElementById('report-generated-at').textContent =
            `Pārskatu sagatavoja: ${currentUser.name} (${roleNames(currentUser.role)}) | Datums: ${formattedDate}`;

        window.print();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Ģenerēt pārskatu';
    }
}

document.getElementById('generate-report-button').addEventListener('click', generateReport);

async function logout() {
    try {
        await api('api/auth.php?action=logout', 'POST');
        location.href = 'login.html';
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

document.getElementById('logout-button').addEventListener('click', logout);

async function initialize() {
    try {
        const authenticated = await loadUser();
        if (!authenticated) return;

        initializeNavigation();
        initializeReportPrinting();

        await Promise.all([
            loadProducts(),
            loadLocations(),
            loadOrders(),
            loadReports(),
            loadUsers()
        ]);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

initialize();