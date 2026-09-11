const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);
router.get('/categories', authorize('products.view'), ctrl.categories);
router.post('/categories', authorize('products.manage'), ctrl.createCategory);
router.get('/', authorize('products.view'), ctrl.list);
router.get('/:id', authorize('products.view'), ctrl.get);
router.post('/', authorize('products.manage'), upload.single('image'), ctrl.create);
router.put('/:id', authorize('products.manage'), upload.single('image'), ctrl.update);
router.post('/units', authorize('products.manage'), ctrl.generateUnits);

module.exports = router;
