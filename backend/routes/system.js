const router = require('express').Router();
const ctrl = require('../controllers/systemController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/search', authenticate, ctrl.search);
router.get('/notifications', authenticate, ctrl.notifications);
router.put('/notifications/read-all', authenticate, ctrl.markAllNotifications);
router.put('/notifications/:id/read', authenticate, ctrl.markNotification);
router.get('/activity', authenticate, authorize('activity.view'), ctrl.activity);
router.get('/audit', authenticate, authorize('audit.view'), ctrl.audit);
router.get('/settings', authenticate, ctrl.settings);
router.put('/settings', authenticate, authorize('settings.manage'), ctrl.saveSettings);

module.exports = router;
