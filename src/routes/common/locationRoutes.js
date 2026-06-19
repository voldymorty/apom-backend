const router = require("express").Router();
const ctrl = require("../../controllers/common/locationController");

/**
 * @swagger
 * /location/states:
 *   get:
 *     summary: Get list of all states
 *     tags: [Location]
 *     security: []
 *     responses:
 *       200:
 *         description: List of states
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       state_id:   { type: integer, example: 23 }
 *                       state_name: { type: string, example: "Tamil Nadu" }
 *                       state_code: { type: string, example: "TN" }
 */
router.get("/states", ctrl.getStates);

/**
 * @swagger
 * /location/districts:
 *   get:
 *     summary: Get districts for a state
 *     tags: [Location]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: state_id
 *         schema:
 *           type: integer
 *           example: 23
 *       - in: query
 *         name: state_name
 *         schema:
 *           type: string
 *           example: "Tamil Nadu"
 *     responses:
 *       200:
 *         description: List of districts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       district_id:   { type: integer, example: 550 }
 *                       district_name: { type: string, example: "Ariyalur" }
 *                       state_id:      { type: integer, example: 23 }
 *       400:
 *         description: Missing query param
 *       404:
 *         description: State not found
 */
router.get("/districts", ctrl.getDistricts);

/**
 * @swagger
 * /location/cities:
 *   get:
 *     summary: Get cities for a district
 *     tags: [Location]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: district_id
 *         schema:
 *           type: integer
 *           example: 550
 *       - in: query
 *         name: district_name
 *         schema:
 *           type: string
 *           example: "Coimbatore"
 *     responses:
 *       200:
 *         description: List of cities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       city_id:     { type: integer, example: 1 }
 *                       city_name:   { type: string, example: "Coimbatore" }
 *                       district_id: { type: integer, example: 550 }
 *       400:
 *         description: Missing query param
 *       404:
 *         description: District not found
 */
router.get("/cities", ctrl.getCities);

module.exports = router;