const router = require("express").Router();
const ctrl = require("../../controllers/farmer/farmerController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

/**
 * @swagger
 * /farmers/dashboard:
 *   get:
 *     summary: Get farmer dashboard summary
 *     description: |
 *       Returns all data needed for the farmer home screen including:
 *       - Farmer profile info and photos
 *       - Land info and segments
 *       - Stat cards (available crops, total sold, monthly earnings, pending pickups)
 *       - Market demand data for all 12 months
 *     tags: [Farmers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     farmer_id:         { type: integer }
 *                     full_name:         { type: string }
 *                     profile_photo_url: { type: string }
 *                     land_photo_url:    { type: string }
 *                     farm_name:         { type: string }
 *                     location:
 *                       type: object
 *                       properties:
 *                         state:    { type: object }
 *                         district: { type: object }
 *                         city:     { type: object }
 *                         pincode:  { type: string }
 *                     total_land:        { type: number }
 *                     land_unit:         { type: string, enum: [acres, hectares, cent] }
 *                     allocated_land:    { type: number }
 *                     available_land:    { type: number }
 *                     total_segments:    { type: integer }
 *                     available_crops:   { type: integer }
 *                     total_sold_tons:   { type: number }
 *                     monthly_earnings:  { type: number }
 *                     pending_pickups:   { type: integer }
 *                     total_earnings:    { type: number }
 *                     current_month:     { type: integer }
 *                     current_month_name: { type: string }
 *                     top_suggested_crop: { type: string }
 *                     all_monthly_demand: { type: object }
 *                     current_month_demand: { type: object }
 *       404:
 *         description: Farmer not found
 */
router.get("/dashboard", authenticate, authorizeRoles("farmer"), ctrl.getDashboard);

/**
 * @swagger
 * /farmers/market-demand:
 *   get:
 *     summary: Get market demand data for a specific month
 *     description: Returns crop demand ratios for the given month from the database.
 *     tags: [Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 3
 *         description: Month number (1-12). Defaults to current month if not provided.
 *     responses:
 *       200:
 *         description: Market demand for the month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     month:              { type: integer, example: 3 }
 *                     month_name:         { type: string, example: "March" }
 *                     top_suggested_crop: { type: string, example: "Spinach" }
 *                     demand:
 *                       type: object
 *                       example: { "Spinach": 0.50, "Tomatoes": 0.25, "Peppers": 0.25 }
 *       400:
 *         description: Invalid month value
 *       404:
 *         description: No demand data found for the month
 */
router.get("/market-demand", authenticate, authorizeRoles("farmer"), ctrl.getMarketDemand);

module.exports = router;