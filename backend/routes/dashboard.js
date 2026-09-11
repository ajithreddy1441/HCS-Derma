const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, rolesOnly } = require('../middleware/auth');

router.use(authenticate);
router.get('/admin', rolesOnly('admin'), ctrl.admin);
router.get('/telecaller', rolesOnly('telecaller', 'admin'), ctrl.telecaller);
router.get('/accountant', rolesOnly('accountant', 'admin'), ctrl.accountant);
router.get('/my-target', ctrl.myTarget);

module.exports = router;
