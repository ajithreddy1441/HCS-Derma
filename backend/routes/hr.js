const router = require('express').Router();
const ctrl = require('../controllers/hrController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/targets', authorize('targets.manage'), ctrl.listTargets);
router.post('/targets', authorize('targets.manage'), ctrl.createTarget);
router.get('/team-targets', authorize('targets.manage'), ctrl.teamTargets);
router.post('/team-targets', authorize('targets.manage'), ctrl.createTeamTarget);
router.get('/incentive-rules', authorize('incentives.manage'), ctrl.incentiveRules);
router.put('/incentive-rules', authorize('incentives.manage'), ctrl.saveIncentiveRules);
router.post('/incentives/calculate', authorize('incentives.manage'), ctrl.calculateIncentives);
router.get('/incentives', authorize('incentives.manage'), ctrl.listIncentives);
router.get('/payroll', authorize('payroll.manage'), ctrl.listPayroll);
router.post('/payroll', authorize('payroll.manage'), ctrl.createPayroll);
router.put('/payroll/:id', authorize('payroll.manage'), ctrl.updatePayroll);
router.get('/performance', authorize('reports.view'), ctrl.performance);

module.exports = router;
