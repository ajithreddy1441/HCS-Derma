const router = require('express').Router();
const ctrl = require('../controllers/qrController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/available', ctrl.available);
router.get('/', authorize('qr.manage'), ctrl.list);
router.post('/generate', authorize('qr.manage'), ctrl.generate);
router.post('/bulk-generate', authorize('qr.manage'), ctrl.bulk);
router.get('/:token', authorize('qr.manage'), ctrl.getByToken);
router.put('/:id', authorize('qr.manage'), ctrl.update);
router.delete('/:id', authorize('qr.manage'), ctrl.remove);

module.exports = router;
