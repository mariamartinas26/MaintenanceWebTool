const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validateRegisterData } = require('../utils/validation');
const { sendCreated, sendBadRequest, sendUnauthorized, sendServerError, sendSuccess } = require('../utils/response');

const generateToken = (userId) => {
    return jwt.sign(
        { userId: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const register = async (req, res, body) => {
    try {
        const { email, password, first_name, last_name, phone } = body;

        const validation = validateRegisterData({ email, password, first_name, last_name, phone });

        if (!validation.isValid) {
            return sendBadRequest(res, 'Validation failed', validation.errors);
        }

        // Check if email already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return sendBadRequest(res, 'Email already registered');
        }

        // Create user
        const userData = {
            email: email.toLowerCase().trim(),
            password,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            phone: phone.trim(),
            role: 'client'
        };

        const newUser = await User.create(userData);
        const token = generateToken(newUser.id);

        sendCreated(res, {
            user: {
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                phone: newUser.phone,
                role: newUser.role
            },
            token: token
        }, 'User registered successfully');

    } catch (error) {
        sendServerError(res, 'Server error during registration');
    }
};

const login = async (req, res, body) => {
    try {
        const { email, password } = body;

        // Basic validation
        if (!email || !password) {
            return sendBadRequest(res, 'Email and password are required');
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return sendUnauthorized(res, 'Invalid credentials');
        }

        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return sendUnauthorized(res, 'Invalid credentials');
        }

        const token = generateToken(user.id);

        sendSuccess(res, {
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone,
                role: user.role
            },
            token: token
        }, 'Login successful');

    } catch (error) {
        console.error('Login error:', error);
        sendServerError(res, 'Server error during login');
    }
};

module.exports = { register, login };