const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);
router.get('/queue', authorize('payments.approve'), ctrl.queue);
router.get('/', authorize('payments.view'), ctrl.list);
router.get('/:id', authorize('payments.view'), ctrl.get);
router.post('/', authorize('payments.upload'), upload.single('screenshot'), ctrl.create);
router.post('/:id/approve', authorize('payments.approve'), ctrl.approve);
router.post('/:id/reject', authorize('payments.approve'), ctrl.reject);
router.post('/:id/verify', authorize('payments.approve'), ctrl.verify);

module.exports = router;
