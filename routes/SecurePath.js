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

    validateNumericId(idString) {
        const sanitized = this.sanitizeInput(String(idString));
        const id = parseInt(sanitized, 10);

        if (isNaN(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
            return null;
        }

        return id;
    }

    //curata parametrii url
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
    }

    sendJSON(res, statusCode, data) {
        this.setSecurityHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
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