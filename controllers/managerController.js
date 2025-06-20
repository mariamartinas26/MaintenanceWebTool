const AccountRequest = require('../models/AccountRequest');
const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');
const { sanitizeInput, safeJsonParse, setSecurityHeaders } = require('../middleware/auth');

function validateInput(input) {
    if (typeof input !== 'string') return input;
    return sanitizeInput(input);
}

function validateInteger(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

function validateRole(role) {
    const validRoles = ['client', 'admin', 'accountant', 'manager', 'mechanic'];
    const cleanRole = sanitizeInput(role);
    return validRoles.includes(cleanRole) ? cleanRole : null;
}

function validateStatus(status) {
    const validStatuses = ['pending', 'approved', 'rejected'];
    const cleanStatus = sanitizeInput(status);
    return validStatuses.includes(cleanStatus) ? cleanStatus : null;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = sanitizeInput(email);
    return emailRegex.test(cleanEmail) && !/<|>|script/i.test(cleanEmail) ? cleanEmail : null;
}

function validateTextLength(text, minLength = 0, maxLength = 1000) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = sanitizeInput(text.trim());
    if (cleanText.length < minLength || cleanText.length > maxLength) return null;
    if (/<script|javascript:|on\w+\s*=|data:/i.test(cleanText)) return null;
    return cleanText;
}

function sanitizeRequest(request) {
    if (!request) return null;

    return {
        id: request.id,
        email: validateInput(request.email),
        first_name: validateInput(request.first_name),
        last_name: validateInput(request.last_name),
        phone: validateInput(request.phone),
        role: validateInput(request.role),
        company_name: validateInput(request.company_name),
        experience_years: validateInteger(request.experience_years, 0, 50),
        message: validateInput(request.message),
        status: validateInput(request.status),
        manager_message: validateInput(request.manager_message),
        assigned_role: validateInput(request.assigned_role),
        created_at: request.created_at,
        processed_at: request.processed_at,
        approved_user_id: request.approved_user_id
    };
}

const getAccountRequests = async (req, res) => {
    try {
        setSecurityHeaders(res);

        console.log('=== getAccountRequests called ===');
        console.log('Query params:', req.query);

        const status = validateStatus(req.query.status);
        const role = validateRole(req.query.role);

        let requests;

        if (status || role) {
            console.log('Using filters...');
            const filters = {};
            if (status && status !== 'all') filters.status = status;
            if (role && role !== 'all') filters.role = role;
            console.log('Filters:', filters);
            requests = await AccountRequest.findByFilters(filters);
        } else {
            console.log('Getting all requests...');
            requests = await AccountRequest.findAll();
        }

        console.log('Requests found:', requests?.length || 0);

        const sanitizedRequests = requests ? requests.map(sanitizeRequest).filter(req => req !== null) : [];

        sendSuccess(res, {
            requests: sanitizedRequests
        }, 'Account requests retrieved successfully');

    } catch (error) {
        console.error('=== ERROR in getAccountRequests ===');
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        sendServerError(res, 'Failed to retrieve account requests');
    }
};

const getAccountRequestById = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const id = validateInteger(req.params.id, 1);

        if (!id) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        const request = await AccountRequest.findById(id);

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        const sanitizedRequest = sanitizeRequest(request);

        sendSuccess(res, {
            request: sanitizedRequest
        }, 'Account request retrieved successfully');

    } catch (error) {
        console.error('Error fetching account request:', error);
        sendServerError(res, 'Failed to retrieve account request');
    }
};

const approveAccountRequest = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const id = validateInteger(req.params.id, 1);
        const manager_message = validateTextLength(req.body.manager_message, 0, 500);
        const assigned_role = validateRole(req.body.assigned_role);

        if (!id) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!assigned_role) {
            return sendBadRequest(res, 'Valid assigned role is required');
        }

        const validApprovalRoles = ['client', 'admin', 'accountant', 'mechanic'];
        if (!validApprovalRoles.includes(assigned_role)) {
            return sendBadRequest(res, 'Invalid role. Must be client, admin, accountant, or mechanic');
        }

        const request = await AccountRequest.findById(id);

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status !== 'pending') {
            return sendBadRequest(res, 'This request has already been processed');
        }

        const email = validateEmail(request.email);
        if (!email) {
            return sendBadRequest(res, 'Invalid email in request');
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return sendBadRequest(res, 'A user with this email already exists');
        }

        const first_name = validateTextLength(request.first_name, 1, 50);
        const last_name = validateTextLength(request.last_name, 1, 50);
        const phone = validateInput(request.phone);

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
            email: validateInput(newUser.email),
            first_name: validateInput(newUser.first_name),
            last_name: validateInput(newUser.last_name),
            role: validateInput(newUser.role)
        };

        sendSuccess(res, {
            message: 'Account request approved successfully',
            user: sanitizedUser
        }, `Account created with role: ${assigned_role}`);

    } catch (error) {
        console.error('Error approving account request:', error);
        sendServerError(res, 'Failed to approve account request');
    }
};

const rejectAccountRequest = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const id = validateInteger(req.params.id, 1);
        const manager_message = validateTextLength(req.body.manager_message, 5, 500);

        console.log('Reject request - ID:', id);
        console.log('Reject request - Body:', req.body);

        if (!id) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!manager_message) {
            return sendBadRequest(res, 'Manager message is required (5-500 characters)');
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
        console.error('Error rejecting account request:', error);
        sendServerError(res, 'Failed to reject account request');
    }
};

const getDashboardStats = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const stats = await AccountRequest.getStats();

        const sanitizedStats = {
            total: validateInteger(stats.total, 0, 100000),
            pending: validateInteger(stats.pending, 0, 100000),
            approved: validateInteger(stats.approved, 0, 100000),
            rejected: validateInteger(stats.rejected, 0, 100000),
            recent: validateInteger(stats.recent, 0, 100000),
            approvalRate: Math.round((stats.approvalRate || 0) * 100) / 100
        };

        sendSuccess(res, {
            stats: sanitizedStats
        }, 'Dashboard statistics retrieved successfully');

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        sendServerError(res, 'Failed to retrieve dashboard statistics');
    }
};

const updateRequestStatus = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const id = validateInteger(req.params.id, 1);
        const status = validateStatus(req.body.status);
        const manager_message = validateTextLength(req.body.manager_message, 0, 500);

        if (!id) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!status) {
            return sendBadRequest(res, 'Valid status is required');
        }

        const request = await AccountRequest.findById(id);

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status !== 'pending') {
            return sendBadRequest(res, 'This request has already been processed');
        }

        const updateData = {
            manager_message: manager_message || null,
            processed_at: new Date()
        };

        await AccountRequest.updateStatus(id, status, updateData);

        const sanitizedRequest = sanitizeRequest(await AccountRequest.findById(id));

        sendSuccess(res, {
            request: sanitizedRequest
        }, `Request status updated to ${status}`);

    } catch (error) {
        console.error('Error updating request status:', error);
        sendServerError(res, 'Failed to update request status');
    }
};

const deleteAccountRequest = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const id = validateInteger(req.params.id, 1);

        if (!id) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        const request = await AccountRequest.findById(id);

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status === 'approved') {
            return sendBadRequest(res, 'Cannot delete approved requests');
        }

        await AccountRequest.delete(id);

        sendSuccess(res, {
            message: 'Account request deleted successfully'
        }, 'Request has been permanently deleted');

    } catch (error) {
        console.error('Error deleting account request:', error);
        sendServerError(res, 'Failed to delete account request');
    }
};

const getRequestHistory = async (req, res) => {
    try {
        setSecurityHeaders(res);

        const email = validateEmail(req.query.email);
        const limit = Math.min(100, Math.max(1, validateInteger(req.query.limit, 1, 100) || 10));

        if (!email) {
            return sendBadRequest(res, 'Valid email is required');
        }

        const history = await AccountRequest.getHistoryByEmail(email, limit);

        const sanitizedHistory = history.map(sanitizeRequest).filter(req => req !== null);

        sendSuccess(res, {
            history: sanitizedHistory,
            total: sanitizedHistory.length
        }, 'Request history retrieved successfully');

    } catch (error) {
        console.error('Error fetching request history:', error);
        sendServerError(res, 'Failed to retrieve request history');
    }
};

module.exports = {
    getAccountRequests,
    getAccountRequestById,
    approveAccountRequest,
    rejectAccountRequest,
    getDashboardStats,
    updateRequestStatus,
    deleteAccountRequest,
    getRequestHistory
};