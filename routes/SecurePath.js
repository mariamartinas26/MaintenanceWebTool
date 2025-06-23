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

    validateFileExtension(filePath) {
        const path = require('path');
        const ext = path.extname(filePath).toLowerCase();
        return this.allowedExtensions.includes(ext);
    }

    validateDirectory(filePath, allowedDirectory) {
        const path = require('path');

        const resolvedPath = path.resolve(filePath);
        const resolvedAllowedDir = path.resolve(allowedDirectory);

        return resolvedPath.startsWith(resolvedAllowedDir);
    }

    validateFile(filePath) {
        const fs = require('fs');

        try {
            if (!fs.existsSync(filePath)) return { valid: false, error: 'File not found' };

            const stat = fs.statSync(filePath);
            if (!stat.isFile()) return { valid: false, error: 'Not a file' };

            if (stat.size > this.maxFileSize) {
                return { valid: false, error: 'File too large' };
            }

            return { valid: true, size: stat.size };
        } catch (error) {
            return { valid: false, error: 'File access error' };
        }
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

    serveStaticFile(req, res, filePath, baseDirectory) {
        const fs = require('fs');
        const path = require('path');

        const validatedPath = this.validatePath(filePath);
        if (!validatedPath) {
            return this.sendJSON(res, 400, {
                success: false,
                message: 'Invalid file path'
            });
        }

        const fullPath = path.join(baseDirectory, validatedPath);

        if (!this.validateDirectory(fullPath, baseDirectory)) {
            return this.sendJSON(res, 403, {
                success: false,
                message: 'Access denied'
            });
        }

        if (!this.validateFileExtension(fullPath)) {
            return this.sendJSON(res, 403, {
                success: false,
                message: 'File type not allowed'
            });
        }

        const fileValidation = this.validateFile(fullPath);
        if (!fileValidation.valid) {
            return this.sendJSON(res, 404, {
                success: false,
                message: fileValidation.error
            });
        }

        try {
            const contentType = this.getContentType(fullPath);
            const fileContent = fs.readFileSync(fullPath);

            this.setSecurityHeaders(res);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': fileValidation.size,
                'Cache-Control': 'public, max-age=3600'
            });

            res.end(fileContent);
        } catch (error) {
            console.error('Error serving file:', this.sanitizeInput(error.message || ''));
            return this.sendJSON(res, 500, {
                success: false,
                message: 'Error serving file'
            });
        }
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

    extractPathParams(path, pattern) {
        const matches = path.match(pattern);
        if (!matches) return null;

        const params = {};

        if (matches.length > 1) {
            const id = this.validateNumericId(matches[1]);
            if (!id) return null;
            params.id = id;
        }

        return params;
    }

    validateRequest(req) {
        const url = require('url');

        const parsedUrl = url.parse(req.url, true);

        const validatedPath = this.validatePath(parsedUrl.pathname);
        if (!validatedPath) {
            throw new Error('Invalid request path');
        }

        const sanitizedQuery = this.sanitizeQuery(parsedUrl.query);

        const sanitizedMethod = this.sanitizeInput(req.method);

        return {
            path: validatedPath,
            query: sanitizedQuery,
            method: sanitizedMethod,
            originalUrl: req.url
        };
    }
}

module.exports = SecurePath;