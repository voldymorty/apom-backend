const router = require("express").Router();
const ctrl = require("../../controllers/vendor/notificationController");
const { authenticate } = require("../../middleware/auth");

router.get("/", authenticate, ctrl.getNotifications);
router.get("/unread-count", authenticate, ctrl.getUnreadCount);
router.put("/:id/read", authenticate, ctrl.markAsRead);
router.put("/read-all", authenticate, ctrl.markAllAsRead);

module.exports = router;
