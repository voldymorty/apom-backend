"use strict";

const router = require("express").Router();
const ctrl   = require("../../controllers/admin/DashboardController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All dashboard routes are protected
router.use(verifyAdminToken);

/**
 * @swagger
 * components:
 *   parameters:
 *     fromDate:
 *       in: query
 *       name: from
 *       schema:
 *         type: string
 *         format: date
 *         example: "2025-03-01"
 *       description: Start date (YYYY-MM-DD). Defaults to 30 days before `to`.
 *     toDate:
 *       in: query
 *       name: to
 *       schema:
 *         type: string
 *         format: date
 *         example: "2025-03-31"
 *       description: End date (YYYY-MM-DD). Defaults to today.
 *     topLimit:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         example: 10
 *       description: Number of results to return (max 50, default 10).
 */

// ════════════════════════════════════════════════════════════════════════════
//  1. SUMMARY STATS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/dashboard/summary:
 *   get:
 *     summary: Platform-wide summary statistics
 *     description: >
 *       Returns high-level counts and financials — users, orders, revenue,
 *       inventory, and deliveries — for the requested date range.
 *       Defaults to the last 30 days when no dates are supplied.
 *     tags: [Admin Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Summary statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: object
 *                       properties:
 *                         from: { type: string, example: "2025-03-01" }
 *                         to:   { type: string, example: "2025-03-31" }
 *                     users:
 *                       type: object
 *                       properties:
 *                         total_users:              { type: integer, example: 1240 }
 *                         total_farmers:            { type: integer, example: 520  }
 *                         total_vendors:            { type: integer, example: 380  }
 *                         total_delivery_personnel: { type: integer, example: 90   }
 *                         new_farmers:              { type: integer, example: 14   }
 *                         new_vendors:              { type: integer, example: 9    }
 *                         new_delivery_personnel:   { type: integer, example: 3    }
 *                     orders:
 *                       type: object
 *                       properties:
 *                         total_orders:     { type: integer, example: 430  }
 *                         completed_orders: { type: integer, example: 390  }
 *                         cancelled_orders: { type: integer, example: 15   }
 *                         pending_orders:   { type: integer, example: 25   }
 *                         total_order_value: { type: number,  example: 184500.00 }
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         total_revenue:     { type: number, example: 184500.00 }
 *                         collected_revenue: { type: number, example: 178200.00 }
 *                         total_refunds:     { type: number, example: 1200.00   }
 *                     inventory:
 *                       type: object
 *                       properties:
 *                         total_stock_kg:      { type: number,  example: 9800.50 }
 *                         low_stock_products:  { type: integer, example: 3       }
 *                     deliveries:
 *                       type: object
 *                       properties:
 *                         total_deliveries:     { type: integer, example: 510 }
 *                         completed_deliveries: { type: integer, example: 480 }
 *                         failed_deliveries:    { type: integer, example: 10  }
 *                         active_deliveries:    { type: integer, example: 20  }
 *       500:
 *         description: Internal server error
 */
router.get("/summary", ctrl.getSummaryStats);

// ════════════════════════════════════════════════════════════════════════════
//  2. DAILY REPORTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/dashboard/daily-reports:
 *   get:
 *     summary: List daily reports for a date range
 *     description: >
 *       Returns paginated rows from the `daily_reports` table.
 *       Defaults to the last 30 days.
 *     tags: [Admin Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 30
 *         description: Rows per page (max 90, default 30)
 *     responses:
 *       200:
 *         description: Paginated list of daily reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           report_id:                   { type: integer, example: 1        }
 *                           report_date:                 { type: string,  example: "2025-03-31" }
 *                           total_orders:                { type: integer, example: 42       }
 *                           completed_orders:            { type: integer, example: 38       }
 *                           cancelled_orders:            { type: integer, example: 2        }
 *                           pending_orders:              { type: integer, example: 2        }
 *                           total_order_value:           { type: number,  example: 18200.00 }
 *                           total_pickups:               { type: integer, example: 20       }
 *                           completed_pickups:           { type: integer, example: 19       }
 *                           failed_pickups:              { type: integer, example: 1        }
 *                           total_deliveries:            { type: integer, example: 38       }
 *                           completed_deliveries:        { type: integer, example: 36       }
 *                           failed_deliveries:           { type: integer, example: 2        }
 *                           total_farmers_supplied:      { type: integer, example: 15       }
 *                           total_quantity_procured_kg:  { type: number,  example: 420.50   }
 *                           total_revenue:               { type: number,  example: 18200.00 }
 *                           total_commission_earned:     { type: number,  example: 910.00   }
 *                           total_farmer_earnings:       { type: number,  example: 12600.00 }
 *                           total_delivery_charges:      { type: number,  example: 760.00   }
 *                           new_farmers_registered:      { type: integer, example: 2        }
 *                           new_vendors_registered:      { type: integer, example: 1        }
 *                           new_delivery_personnel:      { type: integer, example: 0        }
 *                           active_farmers:              { type: integer, example: 80       }
 *                           active_vendors:              { type: integer, example: 55       }
 *                           active_delivery_personnel:   { type: integer, example: 12       }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:       { type: integer, example: 30 }
 *                         page:        { type: integer, example: 1  }
 *                         limit:       { type: integer, example: 30 }
 *                         total_pages: { type: integer, example: 1  }
 *       500:
 *         description: Internal server error
 */
router.get("/daily-reports", ctrl.getDailyReports);

/**
 * @swagger
 * /admin/dashboard/daily-reports/{date}:
 *   get:
 *     summary: Get a single daily report by date
 *     tags: [Admin Dashboard]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-31"
 *         description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Daily report for the given date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     report_id:                  { type: integer, example: 1            }
 *                     report_date:                { type: string,  example: "2025-03-31" }
 *                     total_orders:               { type: integer, example: 42           }
 *                     total_revenue:              { type: number,  example: 18200.00     }
 *                     total_commission_earned:    { type: number,  example: 910.00       }
 *                     total_farmer_earnings:      { type: number,  example: 12600.00     }
 *       400:
 *         description: Invalid date format
 *       404:
 *         description: No report found for this date
 *       500:
 *         description: Internal server error
 */
router.get("/daily-reports/:date", ctrl.getDailyReportByDate);

// ════════════════════════════════════════════════════════════════════════════
//  3. CHARTS / TRENDS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/dashboard/charts/orders:
 *   get:
 *     summary: Daily order count & value trend
 *     tags: [Admin Dashboard - Charts]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Array of daily order metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:             { type: string,  example: "2025-03-01" }
 *                       total_orders:     { type: integer, example: 18           }
 *                       completed_orders: { type: integer, example: 15           }
 *                       cancelled_orders: { type: integer, example: 1            }
 *                       total_value:      { type: number,  example: 7200.00      }
 *       500:
 *         description: Internal server error
 */
router.get("/charts/orders", ctrl.getOrderTrend);

/**
 * @swagger
 * /admin/dashboard/charts/revenue:
 *   get:
 *     summary: Daily revenue & payment trend
 *     tags: [Admin Dashboard - Charts]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Array of daily revenue metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:                    { type: string,  example: "2025-03-01" }
 *                       gross_revenue:           { type: number,  example: 7200.00      }
 *                       collected_revenue:       { type: number,  example: 6900.00      }
 *                       refunds:                 { type: number,  example: 120.00       }
 *                       total_transactions:      { type: integer, example: 20           }
 *                       successful_transactions: { type: integer, example: 18           }
 *                       failed_transactions:     { type: integer, example: 2            }
 *       500:
 *         description: Internal server error
 */
router.get("/charts/revenue", ctrl.getRevenueTrend);

/**
 * @swagger
 * /admin/dashboard/charts/deliveries:
 *   get:
 *     summary: Daily delivery & pickup trend (split by type)
 *     tags: [Admin Dashboard - Charts]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Array of daily delivery metrics grouped by delivery_type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:          { type: string,  example: "2025-03-01" }
 *                       delivery_type: { type: string,  example: "pickup"     }
 *                       total:         { type: integer, example: 12           }
 *                       completed:     { type: integer, example: 11           }
 *                       failed:        { type: integer, example: 1            }
 *                       cancelled:     { type: integer, example: 0            }
 *       500:
 *         description: Internal server error
 */
router.get("/charts/deliveries", ctrl.getDeliveryTrend);

/**
 * @swagger
 * /admin/dashboard/charts/registrations:
 *   get:
 *     summary: Daily new user registrations by role
 *     tags: [Admin Dashboard - Charts]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Array of daily registration counts per role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:  { type: string,  example: "2025-03-01" }
 *                       role:  { type: string,  example: "farmer"     }
 *                       count: { type: integer, example: 3            }
 *       500:
 *         description: Internal server error
 */
router.get("/charts/registrations", ctrl.getRegistrationTrend);

/**
 * @swagger
 * /admin/dashboard/charts/procurement:
 *   get:
 *     summary: Daily crop procurement quantity trend
 *     description: Tracks kg picked up from farmers each day.
 *     tags: [Admin Dashboard - Charts]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *     responses:
 *       200:
 *         description: Array of daily procurement metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:               { type: string,  example: "2025-03-01" }
 *                       total_quantity_kg:  { type: number,  example: 380.50       }
 *                       total_pickups:      { type: integer, example: 18           }
 *                       completed_pickups:  { type: integer, example: 17           }
 *       500:
 *         description: Internal server error
 */
router.get("/charts/procurement", ctrl.getProcurementTrend);

// ════════════════════════════════════════════════════════════════════════════
//  4. TOP PERFORMERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/dashboard/top/farmers:
 *   get:
 *     summary: Top farmers by quantity supplied
 *     tags: [Admin Dashboard - Top Performers]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *       - $ref: '#/components/parameters/topLimit'
 *     responses:
 *       200:
 *         description: Ranked list of top farmers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       farmer_id:         { type: integer, example: 12          }
 *                       full_name:         { type: string,  example: "Ravi Kumar" }
 *                       farm_name:         { type: string,  example: "Ravi Farms" }
 *                       mobile_number:     { type: string,  example: "9876543210" }
 *                       total_quantity_kg: { type: number,  example: 1240.00     }
 *                       total_earnings:    { type: number,  example: 74400.00    }
 *                       total_supplies:    { type: integer, example: 8           }
 *       500:
 *         description: Internal server error
 */
router.get("/top/farmers", ctrl.getTopFarmers);

/**
 * @swagger
 * /admin/dashboard/top/vendors:
 *   get:
 *     summary: Top vendors by total order value
 *     tags: [Admin Dashboard - Top Performers]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *       - $ref: '#/components/parameters/topLimit'
 *     responses:
 *       200:
 *         description: Ranked list of top vendors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vendor_id:         { type: integer, example: 7               }
 *                       shop_name:         { type: string,  example: "Fresh Basket"  }
 *                       owner_name:        { type: string,  example: "Anand Raj"     }
 *                       business_type:     { type: string,  example: "retail"        }
 *                       mobile_number:     { type: string,  example: "9123456780"    }
 *                       total_orders:      { type: integer, example: 28              }
 *                       total_order_value: { type: number,  example: 52400.00        }
 *                       completed_orders:  { type: integer, example: 26              }
 *                       cancelled_orders:  { type: integer, example: 1               }
 *       500:
 *         description: Internal server error
 */
router.get("/top/vendors", ctrl.getTopVendors);

/**
 * @swagger
 * /admin/dashboard/top/products:
 *   get:
 *     summary: Top products by sales volume (kg)
 *     tags: [Admin Dashboard - Top Performers]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *       - $ref: '#/components/parameters/topLimit'
 *     responses:
 *       200:
 *         description: Ranked list of top products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_id:               { type: integer, example: 3          }
 *                       product_name:             { type: string,  example: "Tomato"   }
 *                       product_code:             { type: string,  example: "VEG-TOM"  }
 *                       unit:                     { type: string,  example: "kg"       }
 *                       category_name:            { type: string,  example: "Vegetables"}
 *                       total_quantity_sold_kg:   { type: number,  example: 2400.00    }
 *                       total_revenue:            { type: number,  example: 96000.00   }
 *                       times_ordered:            { type: integer, example: 64         }
 *                       avg_price_per_kg:         { type: number,  example: 40.00      }
 *       500:
 *         description: Internal server error
 */
router.get("/top/products", ctrl.getTopProducts);

/**
 * @swagger
 * /admin/dashboard/top/delivery-personnel:
 *   get:
 *     summary: Top delivery personnel by completed deliveries
 *     tags: [Admin Dashboard - Top Performers]
 *     parameters:
 *       - $ref: '#/components/parameters/fromDate'
 *       - $ref: '#/components/parameters/toDate'
 *       - $ref: '#/components/parameters/topLimit'
 *     responses:
 *       200:
 *         description: Ranked list of top delivery personnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       delivery_person_id:    { type: integer, example: 4            }
 *                       full_name:             { type: string,  example: "Murugan S." }
 *                       vehicle_type:          { type: string,  example: "bike"       }
 *                       vehicle_number:        { type: string,  example: "TN01AB1234" }
 *                       rating:                { type: number,  example: 4.8          }
 *                       mobile_number:         { type: string,  example: "9988776655" }
 *                       total_assigned:        { type: integer, example: 55           }
 *                       completed_deliveries:  { type: integer, example: 52           }
 *                       failed_deliveries:     { type: integer, example: 1            }
 *                       total_distance_km:     { type: number,  example: 620.50       }
 *                       completion_rate_pct:   { type: number,  example: 94.5         }
 *       500:
 *         description: Internal server error
 */
router.get("/top/delivery-personnel", ctrl.getTopDeliveryPersonnel);

module.exports = router;