const router = require('express').Router();
const ctrl = require('../controllers/followupController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('followups.view'), ctrl.list);
router.post('/', authorize('followups.create'), ctrl.create);
router.put('/:id/complete', authorize('followups.edit'), ctrl.complete);
router.post('/alert-admin', authorize('followups.view'), ctrl.alertAdmin);
router.post('/reminders', authorize('followups.view'), ctrl.reminders);

module.exports = router;
