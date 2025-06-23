const AccountRequest = require('../models/AccountRequest');
const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

class AccountRequestController {

    static validateInput(input) {
        if (typeof input !== 'string') return input;
        return sanitizeInput(input);
    }

    static validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const num = parseInt(input);
        if (isNaN(num) || num < min || num > max) return null;
        return num;
    }

    static validateRole(role) {
        const validRoles = ['client', 'admin', 'accountant', 'manager'];
        const cleanRole = sanitizeInput(role);
        return validRoles.includes(cleanRole) ? cleanRole : null;
    }

    static validateStatus(status) {
        const validStatuses = ['pending', 'approved', 'rejected'];
        const cleanStatus = sanitizeInput(status);
        return validStatuses.includes(cleanStatus) ? cleanStatus : null;
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const cleanEmail = sanitizeInput(email);
        return emailRegex.test(cleanEmail) && !/<|>|script/i.test(cleanEmail) ? cleanEmail : null;
    }

    static validateTextLength(text, minLength = 0, maxLength = 1000) {
        if (!text || typeof text !== 'string') return null;
        const cleanText = sanitizeInput(text.trim());
        if (cleanText.length < minLength || cleanText.length > maxLength) return null;
        if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
        return cleanText;
    }

    static sanitizeRequest(request) {
        if (!request) return null;

        return {
            id: request.id,
            email: this.validateInput(request.email),
            first_name: this.validateInput(request.first_name),
            last_name: this.validateInput(request.last_name),
            phone: this.validateInput(request.phone),
            role: this.validateInput(request.role),
            company_name: this.validateInput(request.company_name),
            experience_years: this.validateInteger(request.experience_years, 0, 50),
            message: this.validateInput(request.message),
            status: this.validateInput(request.status),
            manager_message: this.validateInput(request.manager_message),
            assigned_role: this.validateInput(request.assigned_role),
            created_at: request.created_at,
            processed_at: request.processed_at,
            approved_user_id: request.approved_user_id
        };
    }

    static async getAccountRequests(req, res) {
        try {
            setSecurityHeaders(res);

            const status = this.validateStatus(req.query.status);
            const role = this.validateRole(req.query.role);

            let requests;

            if (status || role) {
                const filters = {};
                if (status && status !== 'all') filters.status = status;
                if (role && role !== 'all') filters.role = role;
                requests = await AccountRequest.findByFilters(filters);
            } else {
                requests = await AccountRequest.findAll();
            }

            const sanitizedRequests = requests ? requests.map(req => this.sanitizeRequest(req)).filter(req => req !== null) : [];

            sendSuccess(res, {
                requests: sanitizedRequests
            }, 'Account requests retrieved successfully');

        } catch (error) {
            sendServerError(res, 'Failed to retrieve account requests');
        }
    }


    static async approveAccountRequest(req, res) {
        try {
            setSecurityHeaders(res);

            const id = this.validateInteger(req.params.id, 1);
            const manager_message = this.validateTextLength(req.body.manager_message, 0, 500);
            const assigned_role = this.validateRole(req.body.assigned_role);

            if (!id) {
                return sendBadRequest(res, 'Invalid request ID');
            }

            if (!assigned_role) {
                return sendBadRequest(res, 'Valid assigned role is required');
            }

            const validApprovalRoles = ['client', 'admin', 'accountant'];
            if (!validApprovalRoles.includes(assigned_role)) {
                return sendBadRequest(res, 'Invalid role');
            }

            const request = await AccountRequest.findById(id);

            if (!request) {
                return sendNotFound(res, 'Account request not found');
            }

            if (request.status !== 'pending') {
                return sendBadRequest(res, 'This request has already been processed');
            }

            const email = this.validateEmail(request.email);
            if (!email) {
                return sendBadRequest(res, 'Invalid email in request');
            }

            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return sendBadRequest(res, 'A user with this email already exists');
            }

            const first_name = this.validateTextLength(request.first_name, 1, 50);
            const last_name = this.validateTextLength(request.last_name, 1, 50);
            const phone = this.validateInput(request.phone);

            if (!first_name || !last_name) {
                return sendBadRequest(res, 'Invalid name data in request');
            }

            const userData = {
                email: email,
                password_hash: request.password_hash,
                first_name: first_name,
                last_name: last_name,
                phone: phone,
                role: assigned_role
            };

            const newUser = await User.create(userData);

            const updateData = {
                manager_message: manager_message || null,
                processed_at: new Date(),
                approved_user_id: newUser.id,
                assigned_role: assigned_role
            };

            await AccountRequest.updateStatus(id, 'approved', updateData);

            const sanitizedUser = {
                id: newUser.id,
                email: this.validateInput(newUser.email),
                first_name: this.validateInput(newUser.first_name),
                last_name: this.validateInput(newUser.last_name),
                role: this.validateInput(newUser.role)
            };

            sendSuccess(res, {
                message: 'Account request approved successfully',
                user: sanitizedUser
            }, `Account created with role: ${assigned_role}`);

        } catch (error) {
            sendServerError(res, 'Failed to approve account request');
        }
    }

    static async rejectAccountRequest(req, res) {
        try {
            setSecurityHeaders(res);

            const id = this.validateInteger(req.params.id, 1);
            const manager_message = this.validateTextLength(req.body.manager_message, 5, 500);

            if (!id) {
                return sendBadRequest(res, 'Invalid request ID');
            }

            if (!manager_message) {
                return sendBadRequest(res, 'Manager message is required');
            }

            const request = await AccountRequest.findById(id);

            if (!request) {
                return sendNotFound(res, 'Account request not found');
            }

            if (request.status !== 'pending') {
                return sendBadRequest(res, 'This request has already been processed');
            }

            const updateData = {
                manager_message: manager_message,
                processed_at: new Date()
            };

            await AccountRequest.updateStatus(id, 'rejected', updateData);

            sendSuccess(res, {
                message: 'Account request rejected successfully'
            }, 'Account request has been rejected');

        } catch (error) {
            sendServerError(res, 'Failed to reject account request');
        }
    }
}

module.exports = AccountRequestController;