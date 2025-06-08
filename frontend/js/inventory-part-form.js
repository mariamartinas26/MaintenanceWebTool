// Global variables
let isEditMode = false;
let originalPartData = null;
let hasUnsavedChanges = false;

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function checkAuthentication() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/admin/login';
        return false;
    }
    return true;
}

// Initialize page when DOM loads
document.addEventListener('DOMContentLoaded', function() {

    if (!checkAuthentication()) {
        return;
    }

    initializePage();
    setupEventListeners();
    loadSuppliers();
    checkEditMode();
});

// Setup event listeners
function setupEventListeners() {
    // Form submission
    document.getElementById('partForm').addEventListener('submit', handleFormSubmit);

    // Track changes for unsaved changes warning
    const formInputs = document.querySelectorAll('#partForm input, #partForm select, #partForm textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', handleInputChange);
        input.addEventListener('change', handleInputChange);
    });

    // Character counters
    setupCharacterCounters();

    // Form validation
    setupFormValidation();

    // Modal close events
    document.getElementById('confirmModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideConfirmModal();
        }
    });

    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideConfirmModal();
        }
    });

    // Warn about unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Initialize page settings
function initializePage() {
    // Focus on first input
    document.getElementById('partName').focus();
}

// Check if we're in edit mode
function checkEditMode() {
    const pathParts = window.location.pathname.split('/');
    const editIndex = pathParts.indexOf('edit');

    if (editIndex !== -1 && pathParts[editIndex + 1]) {
        isEditMode = true;
        const partId = pathParts[editIndex + 1];
        document.getElementById('partId').value = partId;

        // Update UI for edit mode
        updateUIForEditMode();

        // Load part data
        loadPartData(partId);
    }
}

// Update UI for edit mode
function updateUIForEditMode() {
    document.getElementById('pageTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Part';
    document.querySelector('.subtitle').textContent = 'Update part information';
    document.getElementById('breadcrumbAction').textContent = 'Edit Part';
    document.getElementById('submitText').textContent = 'Update Part';
}

// Load part data for editing
async function loadPartData(partId) {
    try {
        showLoading(true);

        const response = await fetch(`/inventory/api/parts/${partId}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            originalPartData = data.part;
            populateForm(data.part);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading part data:', error);
        showNotification('Error loading part data', 'error');
        // Redirect to parts list if part not found
        setTimeout(() => {
            window.location.href = '/inventory/parts';
        }, 2000);
    } finally {
        showLoading(false);
    }
}

// Populate form with part data
function populateForm(part) {
    document.getElementById('partName').value = part.name || '';
    document.getElementById('partNumber').value = part.partNumber || '';
    document.getElementById('category').value = part.category || '';
    document.getElementById('description').value = part.description || '';
    document.getElementById('price').value = part.price || '';
    document.getElementById('stockQuantity').value = part.stockQuantity || 0;
    document.getElementById('minimumStockLevel').value = part.minimumStockLevel || 5;
    document.getElementById('supplier').value = part.supplier?.id || '';

    // Update character counters
    updateCharacterCounters();

    // Reset unsaved changes flag
    hasUnsavedChanges = false;
}

// Load suppliers for dropdown
async function loadSuppliers() {
    try {
        // This would need a suppliers endpoint - for now, we'll use a placeholder
        // const response = await fetch('/inventory/api/suppliers');
        // const data = await response.json();

        // Placeholder suppliers
        const suppliers = [
            { id: 1, name: 'Supplier One' },
            { id: 2, name: 'Supplier Two' },
            { id: 3, name: 'Supplier Three' }
        ];

        populateSupplierDropdown(suppliers);
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

// Populate supplier dropdown
function populateSupplierDropdown(suppliers) {
    const select = document.getElementById('supplier');

    // Clear existing options except placeholder
    select.innerHTML = '<option value="">Select supplier...</option>';

    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        select.appendChild(option);
    });
}

// Setup character counters
function setupCharacterCounters() {
    const fieldsWithCounters = [
        { id: 'partName', max: 255 },
        { id: 'partNumber', max: 100 },
        { id: 'description', max: 1000 }
    ];

    fieldsWithCounters.forEach(field => {
        const input = document.getElementById(field.id);
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.id = `${field.id}Counter`;

        input.parentNode.appendChild(counter);

        input.addEventListener('input', () => updateCharacterCounter(field.id, field.max));
        updateCharacterCounter(field.id, field.max);
    });
}

// Update character counter
function updateCharacterCounter(fieldId, maxLength) {
    const input = document.getElementById(fieldId);
    const counter = document.getElementById(`${fieldId}Counter`);
    const currentLength = input.value.length;

    counter.textContent = `${currentLength}/${maxLength}`;

    // Update counter styling based on usage
    counter.className = 'char-counter';
    if (currentLength > maxLength * 0.9) {
        counter.classList.add('warning');
    }
    if (currentLength >= maxLength) {
        counter.classList.add('error');
    }
}

// Update all character counters
function updateCharacterCounters() {
    updateCharacterCounter('partName', 255);
    updateCharacterCounter('partNumber', 100);
    updateCharacterCounter('description', 1000);
}

// Setup form validation
function setupFormValidation() {
    const form = document.getElementById('partForm');
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearFieldError(input));
    });
}

// Validate individual field
function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';

    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = `${getFieldLabel(fieldName)} is required`;
    }

    // Specific field validations
    switch (fieldName) {
        case 'name':
            if (value && value.length < 2) {
                isValid = false;
                errorMessage = 'Part name must be at least 2 characters';
            }
            break;

        case 'price':
            if (value && (isNaN(value) || parseFloat(value) < 0)) {
                isValid = false;
                errorMessage = 'Price must be a positive number';
            }
            break;

        case 'stockQuantity':
        case 'minimumStockLevel':
            if (value && (isNaN(value) || parseInt(value) < 0)) {
                isValid = false;
                errorMessage = 'Quantity must be a positive number';
            }
            break;
    }

    // Update field styling and show/hide error
    updateFieldValidation(field, isValid, errorMessage);

    return isValid;
}

// Clear field error styling
function clearFieldError(field) {
    const formGroup = field.closest('.form-group');
    formGroup.classList.remove('error');

    const existingError = formGroup.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
}

// Update field validation styling
function updateFieldValidation(field, isValid, errorMessage) {
    const formGroup = field.closest('.form-group');

    // Clear previous validation classes
    formGroup.classList.remove('error', 'success');

    // Remove existing error/success messages
    const existingMessage = formGroup.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    if (!isValid && errorMessage) {
        formGroup.classList.add('error');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;

        field.parentNode.appendChild(errorDiv);
    } else if (field.value.trim() && field.hasAttribute('required')) {
        formGroup.classList.add('success');
    }
}

// Get field label for error messages
function getFieldLabel(fieldName) {
    const labels = {
        name: 'Part name',
        partNumber: 'Part number',
        category: 'Category',
        description: 'Description',
        price: 'Price',
        stockQuantity: 'Stock quantity',
        minimumStockLevel: 'Minimum stock level',
        supplierId: 'Supplier'
    };

    return labels[fieldName] || fieldName;
}

// Handle input changes
function handleInputChange() {
    hasUnsavedChanges = true;
    updateFormProgress();
}

// Update form progress
function updateFormProgress() {
    const requiredFields = document.querySelectorAll('#partForm [required]');
    let filledFields = 0;

    requiredFields.forEach(field => {
        if (field.value.trim()) {
            filledFields++;
        }
    });

    const progress = (filledFields / requiredFields.length) * 100;

    // Update progress bar if it exists
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    // Validate all fields
    const form = document.getElementById('partForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    let isFormValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
        }
    });

    if (!isFormValid) {
        showNotification('Please correct the errors before submitting', 'error');
        return;
    }

    // Collect form data
    const formData = collectFormData();

    // Submit form
    try {
        showLoading(true);

        const url = isEditMode
            ? `/inventory/api/parts/${document.getElementById('partId').value}`
            : '/inventory/api/parts';

        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            hasUnsavedChanges = false;
            showNotification(data.message, 'success');

            // Redirect to parts list after short delay
            setTimeout(() => {
                window.location.href = '/inventory/parts';
            }, 1500);
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showNotification('Error saving part', 'error');
    } finally {
        showLoading(false);
    }
}

// Collect form data
function collectFormData() {
    return {
        name: document.getElementById('partName').value.trim(),
        partNumber: document.getElementById('partNumber').value.trim() || null,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value.trim() || null,
        price: parseFloat(document.getElementById('price').value),
        stockQuantity: parseInt(document.getElementById('stockQuantity').value) || 0,
        minimumStockLevel: parseInt(document.getElementById('minimumStockLevel').value) || 5,
        supplierId: document.getElementById('supplier').value ? parseInt(document.getElementById('supplier').value) : null
    };
}

// Reset form
function resetForm() {
    if (hasUnsavedChanges) {
        showConfirmModal(
            'Are you sure you want to reset the form? All unsaved changes will be lost.',
            () => {
                if (isEditMode && originalPartData) {
                    populateForm(originalPartData);
                } else {
                    document.getElementById('partForm').reset();
                    clearAllValidations();
                }
                hasUnsavedChanges = false;
                hideConfirmModal();
            }
        );
    } else {
        if (isEditMode && originalPartData) {
            populateForm(originalPartData);
        } else {
            document.getElementById('partForm').reset();
            clearAllValidations();
        }
    }
}

// Clear all field validations
function clearAllValidations() {
    const formGroups = document.querySelectorAll('.form-group');
    formGroups.forEach(group => {
        group.classList.remove('error', 'success');
        const message = group.querySelector('.error-message, .success-message');
        if (message) {
            message.remove();
        }
    });
}

// Go back to parts list
function goBack() {
    if (hasUnsavedChanges) {
        showConfirmModal(
            'You have unsaved changes. Are you sure you want to leave this page?',
            () => {
                window.location.href = '/inventory/parts';
            }
        );
    } else {
        window.location.href = '/inventory/parts';
    }
}

// Show confirmation modal
function showConfirmModal(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').onclick = onConfirm;
    document.getElementById('confirmModal').style.display = 'block';
}

// Hide confirmation modal
function hideConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    // Add styles if not already added
    if (!document.getElementById('notificationStyles')) {
        const styles = document.createElement('style');
        styles.id = 'notificationStyles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .notification-success { background: #10b981; }
            .notification-error { background: #ef4444; }
            .notification-warning { background: #f59e0b; }
            .notification-info { background: #3b82f6; }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Add to page
    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('partForm').dispatchEvent(new Event('submit'));
    }

    // Ctrl/Cmd + R to reset (with confirmation)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        resetForm();
    }

    // ESC to go back (with confirmation if unsaved changes)
    if (e.key === 'Escape' && !document.querySelector('.modal[style*="block"]')) {
        goBack();
    }
});

// Auto-save functionality (optional)
let autoSaveTimer = null;

function enableAutoSave() {
    const formInputs = document.querySelectorAll('#partForm input, #partForm select, #partForm textarea');

    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(autoSave, 30000); // Auto-save after 30 seconds of inactivity
        });
    });
}

function autoSave() {
    if (!hasUnsavedChanges || !isEditMode) return;

    const formData = collectFormData();

    // Save to localStorage as backup
    localStorage.setItem(`part_form_backup_${document.getElementById('partId').value}`, JSON.stringify({
        data: formData,
        timestamp: Date.now()
    }));

    console.log('Form auto-saved to localStorage');
}

function loadAutoSavedData() {
    if (!isEditMode) return;

    const partId = document.getElementById('partId').value;
    const savedData = localStorage.getItem(`part_form_backup_${partId}`);

    if (savedData) {
        try {
            const { data, timestamp } = JSON.parse(savedData);
            const ageMinutes = (Date.now() - timestamp) / (1000 * 60);

            // Only load if less than 1 hour old
            if (ageMinutes < 60) {
                const useBackup = confirm('We found a recent auto-saved version of this form. Would you like to restore it?');
                if (useBackup) {
                    Object.keys(data).forEach(key => {
                        const element = document.getElementById(key === 'name' ? 'partName' : key);
                        if (element && data[key] !== null) {
                            element.value = data[key];
                        }
                    });
                    hasUnsavedChanges = true;
                }
            }

            // Clean up old backup
            localStorage.removeItem(`part_form_backup_${partId}`);
        } catch (error) {
            console.error('Error loading auto-saved data:', error);
        }
    }
}

// Initialize auto-save
// enableAutoSave();

// Form analytics (track completion rates, common errors, etc.)
function trackFormAnalytics(event, data = {}) {
    // This would integrate with your analytics service
    console.log('Form Analytics:', event, data);
}

// Track form start
trackFormAnalytics('form_started', {
    mode: isEditMode ? 'edit' : 'create',
    timestamp: Date.now()
});

// Track form completion
document.getElementById('partForm').addEventListener('submit', function() {
    trackFormAnalytics('form_submitted', {
        mode: isEditMode ? 'edit' : 'create',
        timestamp: Date.now()
    });
});

// Track form abandonment
window.addEventListener('beforeunload', function() {
    if (hasUnsavedChanges) {
        trackFormAnalytics('form_abandoned', {
            mode: isEditMode ? 'edit' : 'create',
            hasData: Object.values(collectFormData()).some(value => value !== null && value !== '' && value !== 0),
            timestamp: Date.now()
        });
    }
});

// Enhanced form features

// Dynamic category suggestions
function setupCategoryEnhancements() {
    const categorySelect = document.getElementById('category');
    const partNameInput = document.getElementById('partName');

    partNameInput.addEventListener('input', function() {
        const partName = this.value.toLowerCase();
        let suggestedCategory = '';

        // Auto-suggest category based on part name
        if (partName.includes('brake') || partName.includes('frana')) {
            suggestedCategory = 'bicicleta'; // Could be for any vehicle type
        } else if (partName.includes('tire') || partName.includes('cauciuc')) {
            suggestedCategory = 'bicicleta';
        } else if (partName.includes('motor') || partName.includes('engine')) {
            suggestedCategory = 'motocicleta';
        } else if (partName.includes('battery') || partName.includes('baterie')) {
            suggestedCategory = 'trotineta';
        }

        if (suggestedCategory && !categorySelect.value) {
            categorySelect.style.borderColor = '#3b82f6';
            categorySelect.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';

            // Add a small indicator
            const suggestion = document.createElement('div');
            suggestion.className = 'category-suggestion';
            suggestion.innerHTML = `💡 Suggested category: <strong>${suggestedCategory}</strong> <button type="button" onclick="applySuggestion('${suggestedCategory}')">Apply</button>`;

            // Remove existing suggestion
            const existing = categorySelect.parentNode.querySelector('.category-suggestion');
            if (existing) existing.remove();

            categorySelect.parentNode.appendChild(suggestion);

            // Add styles for suggestion
            if (!document.getElementById('suggestionStyles')) {
                const styles = document.createElement('style');
                styles.id = 'suggestionStyles';
                styles.textContent = `
                    .category-suggestion {
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                        border-radius: 6px;
                        padding: 0.5rem;
                        margin-top: 0.5rem;
                        font-size: 0.8rem;
                        color: #1e40af;
                    }
                    .category-suggestion button {
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 0.2rem 0.5rem;
                        border-radius: 4px;
                        font-size: 0.7rem;
                        cursor: pointer;
                        margin-left: 0.5rem;
                    }
                    .category-suggestion button:hover {
                        background: #2563eb;
                    }
                `;
                document.head.appendChild(styles);
            }
        }
    });
}

function applySuggestion(category) {
    document.getElementById('category').value = category;
    document.getElementById('category').dispatchEvent(new Event('change'));

    // Remove suggestion
    const suggestion = document.querySelector('.category-suggestion');
    if (suggestion) suggestion.remove();

    // Reset category field styling
    const categorySelect = document.getElementById('category');
    categorySelect.style.borderColor = '';
    categorySelect.style.boxShadow = '';

    hasUnsavedChanges = true;
}

// Price formatting
function setupPriceFormatting() {
    const priceInput = document.getElementById('price');

    priceInput.addEventListener('blur', function() {
        if (this.value) {
            const price = parseFloat(this.value);
            if (!isNaN(price)) {
                this.value = price.toFixed(2);
            }
        }
    });
}

// Smart defaults
function setupSmartDefaults() {
    const categorySelect = document.getElementById('category');
    const minStockInput = document.getElementById('minimumStockLevel');

    categorySelect.addEventListener('change', function() {
        const category = this.value;
        let suggestedMinStock = 5;

        // Suggest different minimum stock levels based on category
        switch (category) {
            case 'bicicleta':
                suggestedMinStock = 10; // Bikes are popular
                break;
            case 'motocicleta':
                suggestedMinStock = 5; // Motorcycles moderate
                break;
            case 'trotineta':
                suggestedMinStock = 15; // Scooters very popular
                break;
        }

        if (!minStockInput.value || minStockInput.value == 5) {
            minStockInput.value = suggestedMinStock;
            hasUnsavedChanges = true;
        }
    });
}

// Form field dependencies
function setupFieldDependencies() {
    const stockInput = document.getElementById('stockQuantity');
    const minStockInput = document.getElementById('minimumStockLevel');

    // Warn if current stock is below minimum
    function checkStockLevel() {
        const current = parseInt(stockInput.value) || 0;
        const minimum = parseInt(minStockInput.value) || 0;

        if (current < minimum && current > 0) {
            const warning = document.querySelector('.stock-warning') || document.createElement('div');
            warning.className = 'stock-warning';
            warning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Current stock is below minimum level';
            warning.style.cssText = 'color: #f59e0b; font-size: 0.8rem; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.3rem;';

            if (!document.querySelector('.stock-warning')) {
                stockInput.parentNode.appendChild(warning);
            }
        } else {
            const warning = document.querySelector('.stock-warning');
            if (warning) warning.remove();
        }
    }

    stockInput.addEventListener('input', checkStockLevel);
    minStockInput.addEventListener('input', checkStockLevel);
}

// Initialize enhanced features
setupCategoryEnhancements();
setupPriceFormatting();
setupSmartDefaults();
setupFieldDependencies();

// Load auto-saved data if in edit mode
if (isEditMode) {
    setTimeout(loadAutoSavedData, 1000);
}