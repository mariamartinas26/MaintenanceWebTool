const AccountRequest = require('../models/AccountRequest');
const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');

const getAccountRequests = async (req, res) => {
    try {
        const { status, role } = req.query;
        let requests;

        if (status || role) {
            const filters = {};
            if (status && status !== 'all') filters.status = status;
            if (role && role !== 'all') filters.role = role;
            requests = await AccountRequest.findByFilters(filters);
        } else {
            requests = await AccountRequest.findAll();
        }

        sendSuccess(res, {
            requests: requests
        }, 'Account requests retrieved successfully');

    } catch (error) {
        console.error('Error fetching account requests:', error);
        sendServerError(res, 'Failed to retrieve account requests');
    }
};

const getAccountRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        const request = await AccountRequest.findById(parseInt(id));

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        sendSuccess(res, {
            request: request
        }, 'Account request retrieved successfully');

    } catch (error) {
        console.error('Error fetching account request:', error);
        sendServerError(res, 'Failed to retrieve account request');
    }
};

const approveAccountRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_message } = req.body;

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        const request = await AccountRequest.findById(parseInt(id));

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status !== 'pending') {
            return sendBadRequest(res, 'This request has already been processed');
        }

        const existingUser = await User.findByEmail(request.email);
        if (existingUser) {
            return sendBadRequest(res, 'A user with this email already exists');
        }

        const userData = {
            email: request.email,
            password: request.password_hash,
            first_name: request.first_name,
            last_name: request.last_name,
            phone: request.phone,
            role: request.role
        };

        const newUser = await User.create(userData);

        const updateData = {
            admin_message: admin_message || null,
            processed_at: new Date(),
            approved_user_id: newUser.id
        };

        await AccountRequest.updateStatus(parseInt(id), 'approved', updateData);

        sendSuccess(res, {
            message: 'Account request approved successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                role: newUser.role
            }
        }, 'Account created and request approved');

    } catch (error) {
        console.error('Error approving account request:', error);
        sendServerError(res, 'Failed to approve account request');
    }
};

const rejectAccountRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason, admin_message } = req.body;

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!rejection_reason) {
            return sendBadRequest(res, 'Rejection reason is required');
        }

        if (!admin_message || admin_message.trim().length === 0) {
            return sendBadRequest(res, 'Admin message is required');
        }

        const request = await AccountRequest.findById(parseInt(id));

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status !== 'pending') {
            return sendBadRequest(res, 'This request has already been processed');
        }

        const updateData = {
            rejection_reason: rejection_reason,
            admin_message: admin_message.trim(),
            processed_at: new Date()
        };

        await AccountRequest.updateStatus(parseInt(id), 'rejected', updateData);

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
        const stats = await AccountRequest.getStats();

        sendSuccess(res, {
            stats: stats
        }, 'Dashboard statistics retrieved successfully');

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        sendServerError(res, 'Failed to retrieve dashboard statistics');
    }
};

module.exports = {
    getAccountRequests,
    getAccountRequestById,
    approveAccountRequest,
    rejectAccountRequest,
    getDashboardStats
};