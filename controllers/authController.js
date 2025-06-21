const User = require('../models/User');
const AccountRequest = require('../models/AccountRequest');
const jwt = require('jsonwebtoken');
const { validateRegisterData } = require('../utils/validation');
const { sendCreated, sendBadRequest, sendUnauthorized, sendServerError, sendSuccess } = require('../utils/response');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = sanitizeInput(email);
    return emailRegex.test(cleanEmail) && !/<|>|script/i.test(cleanEmail) ? cleanEmail : null;
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') return null;
    if (password.length < 6 || password.length > 128) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(password)) return null;
    return password;
}

function validateRole(role) {
    const validRoles = ['client', 'mechanic', 'admin', 'manager', 'accountant'];
    const cleanRole = sanitizeInput(role);
    return validRoles.includes(cleanRole) ? cleanRole : 'client';
}

function validatePhoneNumber(phone) {
    const cleanPhone = sanitizeInput(phone);
    const romanianPhoneRegex = /^0\d{9}$/;
    const internationalPhoneRegex = /^[\d\s\+\-\(\)]{10,15}$/;
    return (romanianPhoneRegex.test(cleanPhone) || internationalPhoneRegex.test(cleanPhone)) && !/<|>|script/i.test(cleanPhone) ? cleanPhone : null;
}

function validateInteger(input, min = 0, max = 100) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateTextLength(text, minLength = 0, maxLength = 1000) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = sanitizeInput(text.trim());
    if (cleanText.length < minLength || cleanText.length > maxLength) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
    return cleanText;
}

function getSecurityHeaders() {
    return {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self';",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };
}

const generateToken = (userId) => {
    if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Invalid user ID for token generation');
    }

    const payload = {
        userId: parseInt(userId),
        user_id: parseInt(userId),
        iat: Math.floor(Date.now() / 1000)
    };

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT secret not configured properly');
    }

    const options = {
        expiresIn: '30d',
        issuer: 'your-app-name',
        audience: 'your-app-users'
    };

    return jwt.sign(payload, secret, options);
};

const submitRegistrationRequest = async (req, res, body) => {
    try {
        setSecurityHeaders(res);

        const email = validateEmail(body.email);
        const password = validatePassword(body.password);
        const first_name = validateTextLength(body.first_name, 2, 50);
        const last_name = validateTextLength(body.last_name, 2, 50);
        const phone = validatePhoneNumber(body.phone);
        const role = validateRole(body.role);
        const company_name = body.company_name ? validateTextLength(body.company_name, 2, 100) : null;
        const experience_years = body.experience_years ? validateInteger(body.experience_years, 0, 50) : null;
        const message = body.message ? validateTextLength(body.message, 0, 500) : null;

        if (!email) {
            return sendBadRequest(res, 'Invalid email format');
        }

        if (!password) {
            return sendBadRequest(res, 'Password must be 6-128 characters long');
        }

        if (!first_name) {
            return sendBadRequest(res, 'First name must be 2-50 characters long');
        }

        if (!last_name) {
            return sendBadRequest(res, 'Last name must be 2-50 characters long');
        }

        if (!phone) {
            return sendBadRequest(res, 'Invalid phone number format');
        }

        const validation = validateRegisterData({
            email,
            password,
            first_name,
            last_name,
            phone
        });

        if (!validation.isValid) {
            return sendBadRequest(res, 'Validation failed', validation.errors);
        }

        const existingRequest = await AccountRequest.findByEmail(email);
        if (existingRequest) {
            return sendBadRequest(res, 'A request with this email already exists');
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return sendBadRequest(res, 'Email already registered');
        }

        const bcrypt = require('bcryptjs');
        const saltRounds = 12;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const requestData = {
            email: email.toLowerCase(),
            password_hash: password_hash,
            first_name: first_name,
            last_name: last_name,
            phone: phone,
            role: role,
            company_name: company_name,
            experience_years: experience_years,
            message: message,
            status: 'pending'
        };

        await AccountRequest.create(requestData);

        sendCreated(res, {
            message: 'Registration request submitted successfully'
        }, 'Your request has been submitted and is pending approval');

    } catch (error) {
        console.error('Registration request error:', error);
        sendServerError(res, 'Server error during registration request');
    }
};

const login = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const email = validateEmail(req.body.email);
        const password = validatePassword(req.body.password);

        if (!email || !password) {
            res.writeHead(400, {
                'Content-Type': 'application/json',
                ...getSecurityHeaders()
            });
            res.end(JSON.stringify({
                success: false,
                message: 'Valid email and password are required'
            }));
            return;
        }

        if (email.length > 254 || password.length > 128) {
            res.writeHead(400, {
                'Content-Type': 'application/json',
                ...getSecurityHeaders()
            });
            res.end(JSON.stringify({
                success: false,
                message: 'Email or password too long'
            }));
            return;
        }

        const user = await User.findByEmail(email);

        if (!user) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            res.writeHead(401, {
                'Content-Type': 'application/json',
                ...getSecurityHeaders()
            });
            res.end(JSON.stringify({
                success: false,
                message: 'Invalid credentials'
            }));
            return;
        }

        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            res.writeHead(401, {
                'Content-Type': 'application/json',
                ...getSecurityHeaders()
            });
            res.end(JSON.stringify({
                success: false,
                message: 'Invalid credentials'
            }));
            return;
        }

        if (!user.id || user.id <= 0) {
            res.writeHead(500, {
                'Content-Type': 'application/json',
                ...getSecurityHeaders()
            });
            res.end(JSON.stringify({
                success: false,
                message: 'User account error'
            }));
            return;
        }

        const token = generateToken(user.id);

        const responseData = {
            success: true,
            token: token,
            user: {
                id: user.id,
                email: validateInput(user.email),
                first_name: validateInput(user.first_name),
                last_name: validateInput(user.last_name),
                role: validateInput(user.role)
            }
        };

        res.writeHead(200, {
            'Content-Type': 'application/json',
            ...getSecurityHeaders()
        });
        res.end(JSON.stringify(responseData));

    } catch (error) {
        console.error('Login error:', error);

        res.writeHead(500, {
            'Content-Type': 'application/json',
            ...getSecurityHeaders()
        });
        res.end(JSON.stringify({
            success: false,
            message: 'Server error'
        }));
    }
};

module.exports = {
    submitRegistrationRequest,
    login
};