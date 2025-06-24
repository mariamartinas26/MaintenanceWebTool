class SecurePath {
    constructor(options = {}) {
        this.maxPathLength = options.maxPathLength || 1000;
        this.maxBodySize = options.maxBodySize || 1024 * 1024;
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
        this.allowedExtensions = options.allowedExtensions || [
            '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg',
            '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'
        ];
        this.allowedDirectories = options.allowedDirectories || [];
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    validatePath(path) {
        if (typeof path !== 'string') return null;

        if (path.length > this.maxPathLength) return null;

        const sanitized = this.sanitizeInput(path);

        if (this.hasPathTraversal(sanitized)) return null;

        if (this.hasDangerousCharacters(sanitized)) return null;

        const normalized = this.normalizePath(sanitized);

        return normalized;
    }

    hasPathTraversal(path) {
        const dangerousPatterns = [
            /\.\./g,
            /~[\/\\]/g,
            /[\/\\]~[\/\\]/g,
            /\0/g,
            /%2e%2e/gi,
            /%252e%252e/gi,
            /\.\.%2f/gi,
            /%c0%ae/gi,
            /%c1%9c/gi,
        ];

        return dangerousPatterns.some(pattern => pattern.test(path));
    }

    hasDangerousCharacters(path) {
        const dangerousChars = /[<>"|*?:\x00-\x1f\x7f-\x9f]/;
        return dangerousChars.test(path);
    }

    normalizePath(path) {
        return path
            .replace(/[\/\\]+/g, '/')
            .replace(/\/$/, '')
            .toLowerCase();
    }

    validateNumericId(idString) {
        const sanitized = this.sanitizeInput(String(idString));
        const id = parseInt(sanitized, 10);

        if (isNaN(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
            return null;
        }

        return id;
    }

    sanitizeQuery(query) {
        if (!query || typeof query !== 'object') return {};

        const sanitized = {};
        for (const [key, value] of Object.entries(query)) {
            const sanitizedKey = this.sanitizeInput(String(key));

            if (Array.isArray(value)) {
                sanitized[sanitizedKey] = value.map(v => this.sanitizeInput(String(v)));
            } else {
                sanitized[sanitizedKey] = this.sanitizeInput(String(value));
            }
        }

        return sanitized;
    }

    setSecurityHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    }

    sendJSON(res, statusCode, data) {
        this.setSecurityHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    }


    getContentType(filePath) {
        const path = require('path');
        const ext = path.extname(filePath).toLowerCase();

        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        };

        return contentTypes[ext] || 'application/octet-stream';
    }

    processRequestBody(req, callback) {
        let body = '';
        let bodySize = 0;

        req.on('data', chunk => {
            bodySize += chunk.length;

            if (bodySize > this.maxBodySize) {
                const error = new Error('Request body too large');
                error.statusCode = 413;
                return callback(error);
            }

            body += chunk.toString('utf8');
        });

        req.on('end', () => {
            try {
                if (!body.trim()) {
                    const error = new Error('Request body is required');
                    error.statusCode = 400;
                    return callback(error);
                }

                const parsedBody = JSON.parse(body);

                if (typeof parsedBody !== 'object' || parsedBody === null) {
                    const error = new Error('Invalid request body format');
                    error.statusCode = 400;
                    return callback(error);
                }

                const sanitizedBody = this.sanitizeObject(parsedBody);
                callback(null, sanitizedBody);

            } catch (parseError) {
                console.error('JSON parse error:', this.sanitizeInput(parseError.message || ''));
                const error = new Error('Invalid JSON in request body');
                error.statusCode = 400;
                callback(error);
            }
        });

        req.on('error', (error) => {
            console.error('Request error:', this.sanitizeInput(error.message || ''));
            const err = new Error('Request processing error');
            err.statusCode = 400;
            callback(err);
        });
    }

    sanitizeObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return typeof obj === 'string' ? this.sanitizeInput(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = this.sanitizeInput(String(key));
            sanitized[sanitizedKey] = this.sanitizeObject(value);
        }

        return sanitized;
    }


}

module.exports = SecurePath;