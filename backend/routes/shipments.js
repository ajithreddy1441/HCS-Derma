const router = require('express').Router();
const ctrl = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('shipments.view'), ctrl.list);
router.get('/:id', authorize('shipments.view'), ctrl.get);
router.post('/', authorize('shipments.manage'), ctrl.create);
router.get('/:id/track', authorize('shipments.view'), ctrl.track);
router.put('/:id/status', authorize('shipments.manage'), ctrl.updateStatus);

module.exports = router;
