const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('inventory.view'), ctrl.inventory);
router.get('/history', authorize('inventory.view'), ctrl.history);
router.post('/adjust', authorize('inventory.adjust'), ctrl.adjust);

module.exports = router;
