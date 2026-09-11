const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('orders.view'), ctrl.list);
router.get('/:id', authorize('orders.view'), ctrl.get);
router.post('/', authorize('orders.create'), ctrl.create);
router.put('/:id/status', authorize('orders.edit'), ctrl.updateStatus);

module.exports = router;
