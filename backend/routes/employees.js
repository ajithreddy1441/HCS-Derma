const router = require('express').Router();
const ctrl = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/roles', authorize('employees.manage'), ctrl.roles);
router.put('/permissions', authorize('employees.manage'), ctrl.setPermissions);
router.get('/', authorize('employees.view'), ctrl.list);
router.get('/:id', authorize('employees.view'), ctrl.get);
router.post('/', authorize('employees.manage'), ctrl.create);
router.put('/:id', authorize('employees.manage'), ctrl.update);
router.post('/:id/reset-password', authorize('employees.manage'), ctrl.resetPassword);

module.exports = router;
