function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function safeJsonParse(jsonString) {
    try {
        if (!jsonString || typeof jsonString !== 'string') {
            return null;
        }

        if (/<script|javascript:|on\w+\s*=|data:/i.test(jsonString)) {
            console.warn('Potentially malicious content detected in JSON');
            return null;
        }

        const parsed = JSON.parse(jsonString);
        if (typeof parsed === 'object' && parsed !== null) {
            return sanitizeObject(parsed);
        }

        return parsed;
    } catch (error) {
        console.error('Error parsing JSON safely:', error);
        return null;
    }
}

function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return typeof obj === 'string' ? sanitizeInput(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeInput(key);
        sanitized[sanitizedKey] = sanitizeObject(value);
    }

    return sanitized;
}

function validateToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return false;
    }

    const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return jwtRegex.test(token);
}

function safeDecodeJWT(token) {
    try {
        if (!validateToken(token)) {
            return null;
        }

        const parts = token.split('.');
        const payload = parts[1];

        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return safeJsonParse(decoded);
    } catch (error) {
        console.error('Error decoding JWT safely:', error);
        return null;
    }
}

function getCurrentUserRole() {
    try {
        const userString = localStorage.getItem('user');
        if (userString) {
            const userData = safeJsonParse(userString);
            if (userData && userData.role) {
                return sanitizeInput(userData.role);
            }
        }

        const token = localStorage.getItem('token');
        if (token) {
            const payload = safeDecodeJWT(token);
            if (payload && payload.role) {
                return sanitizeInput(payload.role);
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

function getCurrentUserName() {
    try {
        const userString = localStorage.getItem('user');
        if (userString) {
            const userData = safeJsonParse(userString);
            if (userData) {
                const firstName = userData.first_name ? sanitizeInput(userData.first_name) : '';
                const lastName = userData.last_name ? sanitizeInput(userData.last_name) : '';
                return `${firstName} ${lastName}`.trim() || null;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting user name:', error);
        return null;
    }
}



if (typeof window !== 'undefined') {
    window.SecurityUtils = {
        sanitizeInput,
        safeJsonParse,
        sanitizeObject,
        validateToken,
        safeDecodeJWT,
        getCurrentUserRole,
        getCurrentUserName
    };
}