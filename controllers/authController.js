const User = require('../models/User');
const AccountRequest = require('../models/AccountRequest');
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

const submitRegistrationRequest = async (req, res, body) => {
    try {
        const {
            email,
            password,
            first_name,
            last_name,
            phone,
            role,
            company_name,
            experience_years,
            message
        } = body;

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

        const requestData = {
            email: email.toLowerCase().trim(),
            password_hash: password,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            phone: phone.trim(),
            role: role || 'client',
            company_name: company_name ? company_name.trim() : null,
            experience_years: experience_years ? parseInt(experience_years) : null,
            message: message ? message.trim() : null,
            status: 'pending'
        };

        await AccountRequest.create(requestData);

        sendCreated(res, {
            message: 'Registration request submitted successfully'
        }, 'Your request has been submitted and is pending approval');

    } catch (error) {
        sendServerError(res, 'Server error during registration request');
    }
};

const login = async (req, res, body) => {
    try {
        const { email, password } = body;

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
        sendServerError(res, 'Server error during login');
    }
};

module.exports = {
    submitRegistrationRequest,
    login
};