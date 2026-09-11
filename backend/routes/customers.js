const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', authorize('customers.view'), ctrl.list);
router.get('/search', authorize('customers.view'), ctrl.list);
router.get('/:id', authorize('customers.view'), ctrl.get);
router.post('/', authorize('customers.create'), ctrl.create);
router.put('/:id', authorize('customers.edit'), ctrl.update);
router.delete('/:id', authorize('customers.edit'), ctrl.remove);
router.post('/:id/notes', authorize('customers.edit'), ctrl.addNote);

module.exports = router;
