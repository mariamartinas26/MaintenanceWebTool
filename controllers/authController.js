const User = require('../models/User');
const AccountRequest = require('../models/AccountRequest');
const jwt = require('jsonwebtoken');
const { validateRegisterData } = require('../utils/validation');
const { sendCreated, sendBadRequest, sendServerError, sendSuccess, sendUnauthorized } = require('../utils/response');
const { sanitizeInput, setSecurityHeaders } = require('../middleware/auth');

class AuthController {
    constructor() {
        this.submitRegistrationRequest = this.submitRegistrationRequest.bind(this);
        this.login = this.login.bind(this);
    }

    validateInput(input) {
        if (typeof input !== 'string') return input;
        return sanitizeInput(input);
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const cleanEmail = sanitizeInput(email);
        return emailRegex.test(cleanEmail) && !/<|>|script/i.test(cleanEmail) ? cleanEmail : null;
    }

    validatePassword(password) {
        if (!password || typeof password !== 'string') return null;
        if (password.length < 6 || password.length > 128) return null;
        if (/<script|javascript:|on\w+\s*=|data:/i.test(password)) return null;
        return password;
    }

    validateRole(role) {
        const validRoles = ['client', 'admin', 'manager', 'accountant'];
        const cleanRole = sanitizeInput(role);
        return validRoles.includes(cleanRole) ? cleanRole : 'client';
    }

    validatePhoneNumber(phone) {
        const cleanPhone = sanitizeInput(phone);
        const romanianPhoneRegex = /^0\d{9}$/;
        const internationalPhoneRegex = /^[\d\s\+\-\(\)]{10,15}$/;
        return (romanianPhoneRegex.test(cleanPhone) || internationalPhoneRegex.test(cleanPhone)) && !/<|>|script/i.test(cleanPhone) ? cleanPhone : null;
    }

    validateInteger(input, min = 0, max = 100) {
        const num = parseInt(input);
        if (isNaN(num) || num < min || num > max) return null;
        return num;
    }

    validateTextLength(text, minLength = 0, maxLength = 1000) {
        if (!text || typeof text !== 'string') return null;
        const cleanText = sanitizeInput(text.trim());
        if (cleanText.length < minLength || cleanText.length > maxLength) return null;
        if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
        return cleanText;
    }
    generateToken(userId) {
        if (!userId || isNaN(userId) || userId <= 0) {
            throw new Error('Invalid user ID for token generation');
        }

        const payload = {
            userId: parseInt(userId),
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
    }

    async submitRegistrationRequest(req, res, body) {
        try {
            setSecurityHeaders(res);

            const email = this.validateEmail(body.email);
            const password = this.validatePassword(body.password);
            const first_name = this.validateTextLength(body.first_name, 2, 50);
            const last_name = this.validateTextLength(body.last_name, 2, 50);
            const phone = this.validatePhoneNumber(body.phone);
            const role = this.validateRole(body.role);
            const company_name = body.company_name ? this.validateTextLength(body.company_name, 2, 100) : null;
            const experience_years = body.experience_years ? this.validateInteger(body.experience_years, 0, 50) : null;
            const message = body.message ? this.validateTextLength(body.message, 0, 500) : null;

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
            //apelez functia din validate.js
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
            //vedem daca mai exista un request pt acelasi email
            const existingRequest = await AccountRequest.findByEmail(email);
            if (existingRequest) {
                return sendBadRequest(res, 'A request with this email already exists');
            }

            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return sendBadRequest(res, 'Email already registered');
            }
            //daca nu, criptam parola
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
            //apelam modelul
            await AccountRequest.create(requestData);

            sendCreated(res, {
                message: 'Registration request submitted successfully'
            }, 'Your request has been submitted and is pending approval');

        } catch (error) {
            sendServerError(res, 'Server error during registration request');
        }
    }

    async login(req, res, body) {
        try {
            setSecurityHeaders(res);
            const email = this.validateEmail(body.email);
            const password = this.validatePassword(body.password);

            if (!email || !password) {
                return sendBadRequest(res, 'Valid email and password are required');
            }

            if (email.length > 254 || password.length > 128) {
                return sendBadRequest(res, 'Email or password too long');
            }
            //cautam utilizatorul in bd
            const user = await User.findByEmail(email);

            if (!user) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return sendUnauthorized(res, 'Invalid credentials');
            }
            //verificarea parolei
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return sendUnauthorized(res, 'Invalid credentials');
            }

            if (!user.id || user.id <= 0) {
                return sendServerError(res, 'User account error');
            }
            //genram token ul
            const token = this.generateToken(user.id);
            //pregatim raspunsul pt frontend
            sendSuccess(res, {
                token: token,
                user: {
                    id: user.id,
                    email: this.validateInput(user.email),
                    first_name: this.validateInput(user.first_name),
                    last_name: this.validateInput(user.last_name),
                    role: this.validateInput(user.role)
                }
            }, 'Login successful');

        } catch (error) {
            return sendServerError(res, 'Server error');
        }
    }
}

const authController = new AuthController();

module.exports = {
    submitRegistrationRequest: authController.submitRegistrationRequest,
    login: authController.login
};