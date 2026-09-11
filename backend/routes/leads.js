const router = require('express').Router();
const ctrl = require('../controllers/leadController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('leads.view'), ctrl.list);
router.get('/:id', authorize('leads.view'), ctrl.get);
router.post('/', authorize('leads.create'), ctrl.create);
router.put('/:id', authorize('leads.edit'), ctrl.update);
router.post('/:id/convert', authorize('leads.edit'), ctrl.convert);

module.exports = router;
