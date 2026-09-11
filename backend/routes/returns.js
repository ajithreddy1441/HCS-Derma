const router = require('express').Router();
const ctrl = require('../controllers/returnController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);
router.get('/', authorize('returns.view'), ctrl.list);
router.get('/:id', authorize('returns.view'), ctrl.get);
router.post('/', authorize('returns.create'), upload.single('image'), ctrl.create);
router.put('/:id/status', authorize('returns.manage'), ctrl.updateStatus);

module.exports = router;
