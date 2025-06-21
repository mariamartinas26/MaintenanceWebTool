class InventoryDashboard {
    constructor() {
        this.init();
    }
    sanitizeInput(input) {
        return window.SecurityUtils.sanitizeInput(input);
    }

    sanitizeObject(obj) {
        return window.SecurityUtils.sanitizeObject(obj);
    }

    safeSetText(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = String(text);
        }
    }

    createSafeElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = this.sanitizeInput(className);
        }
        if (textContent) {
            this.safeSetText(element, textContent);
        }
        return element;
    }

    getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    checkAuthentication() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/admin/login';
            return false;
        }
        return true;
    }

    init() {
        if (!this.checkAuthentication()) {
            return;
        }
        this.loadDashboardData();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const providersLink = document.getElementById('providers-link');
        if (providersLink) {
            providersLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/suppliers';
            });
        }

        const ordersLink = document.getElementById('orders-link');
        if (ordersLink) {
            ordersLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/suppliers#orders';
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        this.updateActiveNavigation();
    }

    updateActiveNavigation() {
        const currentPath = window.location.pathname;
        const sidebarLinks = document.querySelectorAll('.sidebar-nav a');

        sidebarLinks.forEach(link => {
            const linkPath = new URL(link.href).pathname;
            if (currentPath === linkPath) {
                link.parentElement.classList.add('active');
            } else {
                link.parentElement.classList.remove('active');
            }
        });
    }

    async loadDashboardData() {
        try {
            await Promise.all([
                this.loadStatistics(),
                this.loadCategories(),
                this.loadAdminInfo()
            ]);
        } catch (error) {
        }
    }

    async loadStatistics() {
        try {
            const response = await fetch('/inventory/api/parts/statistics', {
                headers: this.getAuthHeaders()
            });
            const data = await response.json();

            if (response.status === 401) {
                this.handleAuthError();
                return;
            }

            if (data.success) {
                this.updateStatisticsDisplay(this.sanitizeObject(data.statistics));
            }
        } catch (error) {
            // Handle error silently
        }
    }

    updateStatisticsDisplay(stats) {
        const totalPartsEl = document.getElementById('totalParts');
        const inventoryValueEl = document.getElementById('inventoryValue');
        const totalCategoriesEl = document.getElementById('totalCategories');

        if (totalPartsEl) {
            this.safeSetText(totalPartsEl, stats.totalParts.toLocaleString());
        }

        if (inventoryValueEl) {
            this.safeSetText(inventoryValueEl, stats.totalInventoryValue.toLocaleString('ro-RO', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }));
        }

        if (totalCategoriesEl) {
            this.safeSetText(totalCategoriesEl, stats.totalCategories.toLocaleString());
        }
    }

    async loadCategories() {
        try {
            const [categoriesResponse, partsResponse] = await Promise.all([
                fetch('/inventory/api/parts/categories', {
                    headers: this.getAuthHeaders()
                }),
                fetch('/inventory/api/parts', {
                    headers: this.getAuthHeaders()
                })
            ]);

            if (categoriesResponse.status === 401 || partsResponse.status === 401) {
                this.handleAuthError();
                return;
            }

            const categoriesData = await categoriesResponse.json();
            const partsData = await partsResponse.json();

            if (categoriesData.success && partsData.success) {
                this.displayCategories(
                    this.sanitizeObject(categoriesData.categories),
                    this.sanitizeObject(partsData.parts)
                );
            }
        } catch (error) {
            // Handle error silently - no loading message shown
        }
    }

    displayCategories(categories, parts) {
        const container = document.getElementById('categoriesGrid');
        if (!container) return;

        // Extract unique categories from parts instead of using the broken categories endpoint
        const uniqueCategories = [...new Set(parts.map(part => part.category))].filter(Boolean);

        if (uniqueCategories.length === 0) {
            return; // Don't show anything if no categories
        }

        // Count parts by category
        const categoryCounts = {};
        uniqueCategories.forEach(categoryName => {
            categoryCounts[categoryName] = parts.filter(part => part.category === categoryName).length;
        });

        container.innerHTML = '';

        uniqueCategories.forEach(categoryName => {
            const categoryCard = this.createSafeElement('div', 'category-card');

            const categoryTitle = this.createSafeElement('h4', '', categoryName);
            const categoryCount = this.createSafeElement('div', 'count', String(categoryCounts[categoryName] || 0));

            categoryCard.appendChild(categoryTitle);
            categoryCard.appendChild(categoryCount);
            container.appendChild(categoryCard);
        });
    }

    async loadAdminInfo() {
        try {
            const adminName = localStorage.getItem('adminName') || 'Admin';
            const adminNameEl = document.getElementById('admin-name');
            if (adminNameEl) {
                this.safeSetText(adminNameEl, this.sanitizeInput(adminName));
            }
        } catch (error) {
            const adminNameEl = document.getElementById('admin-name');
            if (adminNameEl) {
                this.safeSetText(adminNameEl, 'Admin');
            }
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('adminName');
            window.location.href = '/admin/login';
        }
    }

    handleAuthError() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminName');
        setTimeout(() => {
            window.location.href = '/admin/login';
        }, 1000);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryDashboard = new InventoryDashboard();
});