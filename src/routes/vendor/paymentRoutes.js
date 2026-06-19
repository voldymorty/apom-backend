const router = require("express").Router();
const ctrl = require("../../controllers/vendor/paymentController");
const { authenticate } = require("../../middleware/auth");

router.post("/initiate", authenticate, ctrl.initiatePayment);
router.post("/verify", authenticate, ctrl.verifyPayment);
router.post("/failure", authenticate, ctrl.handlePaymentFailure);

module.exports = router;
