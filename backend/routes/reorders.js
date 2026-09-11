const router = require('express').Router();
const ctrl = require('../controllers/reorderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('reorders.view'), ctrl.list);
router.get('/:id/prefill', authorize('reorders.view'), ctrl.prefill);
router.post('/:id/convert', authorize('reorders.view'), ctrl.convert);

module.exports = router;
