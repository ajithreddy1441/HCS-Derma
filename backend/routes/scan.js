const router = require('express').Router();
const ctrl = require('../controllers/scanController');
const { optionalAuth } = require('../middleware/optionalAuth');
const { authenticate } = require('../middleware/auth');

router.get('/internal/:value', authenticate, ctrl.internalScan);
router.post('/issue', authenticate, ctrl.reportIssue);
router.get('/issues', authenticate, ctrl.issues);
router.get('/history', authenticate, ctrl.history);
router.get('/:value', optionalAuth, (req, res, next) => {
  if (req.user) return ctrl.internalScan(req, res, next);
  return ctrl.publicScan(req, res, next);
});

module.exports = router;
