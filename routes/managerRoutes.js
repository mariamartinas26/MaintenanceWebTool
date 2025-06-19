const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { verifyToken, requireManager } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireManager);

router.get('/requests', managerController.getAccountRequests);
router.get('/requests/stats', managerController.getDashboardStats);
router.get('/requests/:id', managerController.getAccountRequestById);
router.post('/requests/:id/approve', managerController.approveAccountRequest);
router.post('/requests/:id/reject', managerController.rejectAccountRequest);
router.delete('/requests/cleanup', managerController.cleanupOldRequests);

module.exports = router;