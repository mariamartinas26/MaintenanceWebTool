const AccountRequest = require('../models/AccountRequest');
const User = require('../models/User');
const { sendSuccess, sendBadRequest, sendServerError, sendNotFound } = require('../utils/response');

const getAccountRequests = async (req, res) => {
    try {
        console.log('=== getAccountRequests called ===');
        console.log('Query params:', req.query);

        const { status, role } = req.query;
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

        sendSuccess(res, {
            requests: requests
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
        const { manager_message, assigned_role } = req.body;

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!assigned_role) {
            return sendBadRequest(res, 'Assigned role is required');
        }

        // Validează rolul
        const validRoles = ['client', 'admin', 'accountant'];
        if (!validRoles.includes(assigned_role)) {
            return sendBadRequest(res, 'Invalid role. Must be client, admin, or accountant');
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
            password_hash: request.password_hash,
            first_name: request.first_name,
            last_name: request.last_name,
            phone: request.phone,
            role: assigned_role  // Folosește rolul ales de manager
        };

        const newUser = await User.create(userData);

        const updateData = {
            manager_message: manager_message || null,
            processed_at: new Date(),
            approved_user_id: newUser.id,
            assigned_role: assigned_role  // ✅ Salvează rolul asignat în request
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
        }, `Account created with role: ${assigned_role}`);

    } catch (error) {
        console.error('Error approving account request:', error);
        sendServerError(res, 'Failed to approve account request');
    }
};

const rejectAccountRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { manager_message } = req.body;  // Changed from admin_message, removed rejection_reason

        console.log('Reject request - ID:', id);
        console.log('Reject request - Body:', req.body);

        if (!id || isNaN(id)) {
            return sendBadRequest(res, 'Invalid request ID');
        }

        if (!manager_message || manager_message.trim().length === 0) {
            return sendBadRequest(res, 'Manager message is required');
        }

        const request = await AccountRequest.findById(parseInt(id));

        if (!request) {
            return sendNotFound(res, 'Account request not found');
        }

        if (request.status !== 'pending') {
            return sendBadRequest(res, 'This request has already been processed');
        }

        const updateData = {
            manager_message: manager_message.trim(),  // Changed from admin_message
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