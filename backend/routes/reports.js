const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/:type', authorize('reports.view'), ctrl.run);

module.exports = router;
