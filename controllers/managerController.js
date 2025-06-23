const AccountRequest = require('../models/AccountRequest');
const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');
const { setSecurityHeaders } = require('../middleware/auth');
//functii de validare
const {isValidEmail, isValidName, isValidPhone, sanitizeString, sanitizeUserInput} = require('../utils/validation');

class AccountRequestController {

    static validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const num = parseInt(input);
        if (isNaN(num) || num < min || num > max) return null;
        return num;
    }

    static validateRole(role) {
        const validRoles = ['client', 'admin', 'accountant'];
        const cleanRole = sanitizeString(role);
        return validRoles.includes(cleanRole) ? cleanRole : null;
    }

    static validateStatus(status) {
        const validStatuses = ['pending', 'approved', 'rejected'];
        const cleanStatus = sanitizeString(status);
        return validStatuses.includes(cleanStatus) ? cleanStatus : null;
    }

    static validateTextLength(text, minLength = 0, maxLength = 1000) {
        if (!text || typeof text !== 'string') return null;
        const cleanText = sanitizeString(text.trim());
        if (cleanText.length < minLength || cleanText.length > maxLength) return null;
        if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
        return cleanText;
    }

    static sanitizeRequest(request) {
        if (!request) return null;

        const sanitized = sanitizeUserInput(request);

        return {
            id: request.id,
            email: sanitized.email,
            first_name: sanitized.first_name,
            last_name: sanitized.last_name,
            phone: sanitized.phone,
            role: sanitized.role,
            message: sanitized.message,
            status: sanitized.status,
            manager_message: sanitized.manager_message,
            assigned_role: sanitized.assigned_role,
            created_at: request.created_at,
            processed_at: request.processed_at,
            approved_user_id: request.approved_user_id
        };
    }

    static async getAccountRequests(req, res) {
        try {
            setSecurityHeaders(res);

            let requests;
            //toate requesturile din bd
            requests = await AccountRequest.findAll();

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
            const assigned_role = this.validateRole(req.body.assigned_role);

            if (!id) {
                return sendBadRequest(res, 'Invalid request ID');
            }

            if (!assigned_role) {
                return sendBadRequest(res, 'Valid assigned role is required');
            }

            const validApprovalRoles = ['client', 'admin', 'accountant'];
            if (!validApprovalRoles.includes(assigned_role)) {
                return sendBadRequest(res, 'Invalid role for approval');
            }

            //caut requestul dupa id in bd
            const request = await AccountRequest.findById(id);

            if (!request) {
                return sendNotFound(res, 'Account request not found');
            }

            if (request.status !== 'pending') {
                return sendBadRequest(res, 'This request has already been processed');
            }

            if (!isValidEmail(request.email)) {
                return sendBadRequest(res, 'Invalid email in request');
            }

            const existingUser = await User.findByEmail(request.email);
            if (existingUser) {
                return sendBadRequest(res, 'A user with this email already exists');
            }

            if (!isValidName(request.first_name)) {
                return sendBadRequest(res, 'Invalid first name in request');
            }

            if (!isValidName(request.last_name)) {
                return sendBadRequest(res, 'Invalid last name in request');
            }

            if (!isValidPhone(request.phone)) {
                return sendBadRequest(res, 'Invalid phone number in request');
            }

            const userData = {
                email: request.email,
                password_hash: request.password_hash,
                first_name: request.first_name,
                last_name: request.last_name,
                phone: request.phone,
                role: assigned_role
            };

            //creez un nou user
            const newUser = await User.create(userData);

            const updateData = {
                processed_at: new Date(),
                approved_user_id: newUser.id,
                assigned_role: assigned_role
            };

            await AccountRequest.updateStatus(id, 'approved', updateData);

            const sanitizedUserData = sanitizeUserInput({
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                role: newUser.role
            });

            sendSuccess(res, {
                message: 'Account request approved successfully',
                user: sanitizedUserData
            }, `Account created with role: ${assigned_role}`);

        } catch (error) {
            sendServerError(res, 'Failed to approve account request');
        }
    }

    static async rejectAccountRequest(req, res) {
        try {
            setSecurityHeaders(res);

            const id = this.validateInteger(req.params.id, 1);

            if (!id) {
                return sendBadRequest(res, 'Invalid request ID');
            }

            if (!manager_message) {
                return sendBadRequest(res, 'Manager message is required and must be at least 5 characters');
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
            //updatam statusul requestului
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