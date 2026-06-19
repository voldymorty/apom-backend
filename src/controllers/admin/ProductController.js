const db = require("../../models");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");

// ════════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════════

// ─── GET /admin/products/categories ───────────────────────────
exports.getAllCategories = async (req, res) => {
  try {
    const { is_active } = req.query;
    const where = {};
    if (is_active !== undefined) where.is_active = is_active === "true";

    const categories = await db.Category.findAll({
      where,
      order: [["display_order", "ASC"], ["category_name", "ASC"]],
    });

    return res.json({ success: true, data: { categories } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /admin/products/categories ──────────────────────────
exports.createCategory = async (req, res) => {
  try {
    const { category_name, category_code, description, display_order } = req.body;

    const image_url = req.files?.image ? `/uploads/categories/${req.files.image[0].filename}` : null;
    const icon_url  = req.files?.icon  ? `/uploads/categories/${req.files.icon[0].filename}`  : null;

    const existing = await db.Category.findOne({
      where: {
        [Op.or]: [{ category_name }, { category_code }],
      },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Category name or code already exists" });
    }

    const category = await db.Category.create({
      category_name,
      category_code,
      description,
      display_order: display_order || 0,
      image_url,
      icon_url,
    });

    return res.status(201).json({ success: true, data: { category } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /admin/products/categories/:id ───────────────────────
exports.updateCategory = async (req, res) => {
  try {
    const category = await db.Category.findByPk(parseInt(req.params.id));
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const { category_name, category_code, description, display_order, is_active } = req.body;

    // ─── Handle image replacement ─────────────────────────────
    if (req.files?.image) {
      if (category.image_url) {
        const oldPath = path.join(__dirname, "../../uploads", path.basename(category.image_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      category.image_url = `/uploads/categories/${req.files.image[0].filename}`;
    }
    if (req.files?.icon) {
      if (category.icon_url) {
        const oldPath = path.join(__dirname, "../../uploads", path.basename(category.icon_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      category.icon_url = `/uploads/categories/${req.files.icon[0].filename}`;
    }

    if (category_name  !== undefined) category.category_name  = category_name;
    if (category_code  !== undefined) category.category_code  = category_code;
    if (description    !== undefined) category.description    = description;
    if (display_order  !== undefined) category.display_order  = display_order;
    if (is_active      !== undefined) category.is_active      = is_active;

    await category.save();

    return res.json({ success: true, data: { category } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /admin/products/categories/:id ────────────────────
exports.deleteCategory = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const category = await db.Category.findByPk(parseInt(req.params.id), {
      include: [{ model: db.Product, as: "products", attributes: ["product_id"] }],
      transaction: t,
    });

    if (!category) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const productIds = category.products.map((p) => p.product_id);

    if (productIds.length > 0) {
      // ── Block if real business data exists ──────────────────
      const orderItemCount = await db.OrderItem.count({
        where: { product_id: { [Op.in]: productIds } }, transaction: t,
      });
      const farmerCropCount = await db.FarmerCrop.count({
        where: { product_id: { [Op.in]: productIds } }, transaction: t,
      });

      if (orderItemCount > 0 || farmerCropCount > 0) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "Cannot delete this category because some products under it are linked to existing orders or farmer crops.",
        });
      }

      // ── Safe to delete: wipe inventory + pricing first ──────
      const inventories = await db.Inventory.findAll({
        where: { product_id: { [Op.in]: productIds } },
        attributes: ["inventory_id"],
        transaction: t,
      });
      const inventoryIds = inventories.map((i) => i.inventory_id);

      if (inventoryIds.length > 0) {
        await db.InventoryTransaction.destroy({
          where: { inventory_id: { [Op.in]: inventoryIds } },
          transaction: t,
        });
        await db.Inventory.destroy({
          where: { product_id: { [Op.in]: productIds } },
          transaction: t,
        });
      }

      await db.Pricing.destroy({
        where: { product_id: { [Op.in]: productIds } },
        transaction: t,
      });

      await db.Product.destroy({
        where: { product_id: { [Op.in]: productIds } },
        transaction: t,
      });
    }

    await category.destroy({ transaction: t });
    await t.commit();

    return res.json({ success: true, message: "Category deleted permanently" });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════════════════════════════

// ─── GET /admin/products ───────────────────────────────────────
// Lean list: no nested inventory/pricing arrays.
// Returns grade_stock summary + active_pricing_count instead.
// Detail view (getProductById) still returns full nested data.
exports.getAllProducts = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { search, category_id, is_active, is_seasonal } = req.query;

    const where = {};
    if (search)      where.product_name = { [Op.like]: `%${search}%` };
    if (category_id) where.category_id  = parseInt(category_id);
    if (is_active   !== undefined) where.is_active   = is_active   === "true";
    if (is_seasonal !== undefined) where.is_seasonal = is_seasonal === "true";

    // ─── Step 1: fetch products + category only ───────────────
    const { count, rows } = await db.Product.findAndCountAll({
      where,
      include: [
        {
          model: db.Category,
          as: "category",
          attributes: ["category_id", "category_name", "category_code"],
        },
      ],
      attributes: [
        "product_id", "product_name", "product_code",
        "unit", "image_url", "is_seasonal", "is_active",
        "season_start_month", "season_end_month", "created_at",
      ],
      order:    [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    if (!rows.length) {
      return res.json({
        success: true,
        data: {
          products: [],
          pagination: { total: 0, total_pages: 0, current_page: page, per_page: limit },
        },
      });
    }

    const productIds = rows.map((p) => p.product_id);

    // ─── Step 2: single query for all inventory rows ──────────
    const inventoryRows = await db.Inventory.findAll({
      where:      { product_id: { [Op.in]: productIds } },
      attributes: ["product_id", "grade", "available_quantity_kg"],
    });

    // ─── Step 3: single query for active pricing counts ───────
    const pricingRows = await db.Pricing.findAll({
      where:      { product_id: { [Op.in]: productIds }, is_active: true },
      attributes: ["product_id"],
    });

    // ─── Step 4: build inventory map { product_id: { A: 200, B: 150, C: 100 } }
    const inventoryMap = {};
    inventoryRows.forEach((inv) => {
      if (!inventoryMap[inv.product_id]) inventoryMap[inv.product_id] = {};
      inventoryMap[inv.product_id][inv.grade] = parseFloat(inv.available_quantity_kg || 0);
    });

    // ─── Step 5: build pricing count map { product_id: 3 } ───
    const pricingCountMap = {};
    pricingRows.forEach((p) => {
      pricingCountMap[p.product_id] = (pricingCountMap[p.product_id] || 0) + 1;
    });

    // ─── Step 6: assemble final lean response ─────────────────
    const products = rows.map((p) => {
      const gradeStock = inventoryMap[p.product_id] || {};
      const totalStock = Object.values(gradeStock).reduce((sum, qty) => sum + qty, 0);

      return {
        ...p.toJSON(),
        current_stock_kg:     parseFloat(totalStock.toFixed(2)),
        grade_stock:          gradeStock,                          // { A: 200, B: 150, C: 100 }
        active_pricing_count: pricingCountMap[p.product_id] || 0,
      };
    });

    return res.json({
      success: true,
      data: {
        products,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/products/:id ───────────────────────────────────
exports.getProductById = async (req, res) => {
  try {
    const product = await db.Product.findOne({
      where: { product_id: parseInt(req.params.id) },
      include: [
        {
          model: db.Category,
          as: "category",
          attributes: ["category_id", "category_name", "category_code"],
        },
        {
          model: db.Inventory,
          as: "inventory",
          attributes: ["inventory_id", "grade", "available_quantity_kg", "reserved_quantity_kg", "minimum_stock_alert", "warehouse_location", "last_restocked_at"],
        },
        {
          model: db.Pricing,
          as: "pricing",
          required: false,
          attributes: ["pricing_id", "grade", "base_price_per_kg", "wholesale_price_per_kg", "retail_price_per_kg", "minimum_order_kg", "effective_from", "effective_to", "is_active"],
        },
      ],
    });

    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const pJson        = product.toJSON();
    const currentStock = pJson.inventory.reduce(
      (sum, inv) => sum + parseFloat(inv.available_quantity_kg || 0), 0
    );

    return res.json({
      success: true,
      data: { ...pJson, current_stock_kg: parseFloat(currentStock.toFixed(2)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /admin/products ──────────────────────────────────────
// Creates product + optional initial inventory + optional pricing
exports.createProduct = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const {
      category_id,
      product_name,
      product_code,
      description,
      unit,
      is_seasonal,
      season_start_month,
      season_end_month,
      inventory:  rawInventory,
      pricing:    rawPricing,
    } = req.body;

    // ─── Parse JSON strings from multipart/form-data ──────────
    let inventory = [], pricing = [];
    try {
      inventory = typeof rawInventory === 'string'
        ? JSON.parse(rawInventory) : (rawInventory ?? []);
      pricing = typeof rawPricing === 'string'
        ? JSON.parse(rawPricing) : (rawPricing ?? []);
    } catch (parseErr) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON in inventory or pricing field',
      });
    }

    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

    // ─── Check duplicate product_code ─────────────────────────
    const existing = await db.Product.findOne({ where: { product_code }, transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Product code already exists" });
    }

    for (const inv of inventory) {
      if (!inv.grade?.trim()) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Inventory grade is required",
        });
      }
    }

    for (const p of pricing) {
      if (!p.grade?.trim()) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Pricing grade is required",
        });
      }
    }

    const inventoryGrades = new Set(
      inventory.map(i => String(i.grade).trim().toUpperCase())
    );

    const pricingGrades = new Set(
      pricing.map(p => String(p.grade).trim().toUpperCase())
    );

    for (const grade of inventoryGrades) {
      if (!pricingGrades.has(grade)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Pricing details are required for Grade ${grade}`,
        });
      }
    }

    for (const grade of pricingGrades) {
      if (!inventoryGrades.has(grade)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Inventory details are required for Grade ${grade}`,
        });
      }
    }

    if (!inventory.length || !pricing.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Inventory and pricing details are required",
      });
    }

    if (inventoryGrades.size !== inventory.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Duplicate grades found in inventory",
      });
    }

    if (pricingGrades.size !== pricing.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Duplicate grades found in pricing",
      });
    }

    // ─── Create product ───────────────────────────────────────
    const product = await db.Product.create({
      category_id: parseInt(category_id),
      product_name,
      product_code,
      description,
      unit:               unit || "kg",
      image_url,
      is_seasonal:        is_seasonal || false,
      season_start_month: season_start_month || null,
      season_end_month:   season_end_month   || null,
    }, { transaction: t });

    // ─── Optional: create inventory entries ───────────────────
    if (inventory && Array.isArray(inventory) && inventory.length > 0) {
      const inventoryRecords = inventory.map((inv) => ({
        product_id:            product.product_id,
        grade:                 inv.grade,
        available_quantity_kg: inv.available_quantity_kg ?? 0,
        reserved_quantity_kg:  0,
        warehouse_location:    inv.warehouse_location    ?? null,
        minimum_stock_alert:   inv.minimum_stock_alert   ?? 10,
      }));
      await db.Inventory.bulkCreate(inventoryRecords, { transaction: t });
    }

    // ─── Optional: create pricing entries ─────────────────────
    if (pricing && Array.isArray(pricing) && pricing.length > 0) {
      const pricingRecords = pricing.map((p) => ({
        product_id:             product.product_id,
        grade:                  p.grade,
        base_price_per_kg:      p.base_price_per_kg,
        wholesale_price_per_kg: p.wholesale_price_per_kg,
        retail_price_per_kg:    p.retail_price_per_kg    ?? null,
        minimum_order_kg:       p.minimum_order_kg       ?? 10,
        effective_from:         p.effective_from,
        effective_to:           p.effective_to           ?? null,
        is_active:              true,
        updated_by:             req.user.user_id,
      }));
      await db.Pricing.bulkCreate(pricingRecords, { transaction: t });
    }

    await t.commit();

    // ─── Return full product with nested data ─────────────────
    const fullProduct = await db.Product.findOne({
      where: { product_id: product.product_id },
      include: [
        { model: db.Category,  as: "category",  attributes: ["category_id", "category_name"] },
        { model: db.Inventory, as: "inventory" },
        { model: db.Pricing,   as: "pricing" },
      ],
    });

    return res.status(201).json({ success: true, data: { product: fullProduct } });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /admin/products/:id ───────────────────────────────────
exports.updateProduct = async (req, res) => {
  try {
    const product = await db.Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const {
      category_id, product_name, product_code, description,
      unit, is_seasonal, season_start_month, season_end_month, is_active,
    } = req.body;

    // ─── Handle image replacement ─────────────────────────────
    if (req.file) {
      if (product.image_url) {
        const oldPath = path.join(__dirname, "../../uploads/products", path.basename(product.image_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      product.image_url = `/uploads/products/${req.file.filename}`;
    }

    if (category_id        !== undefined) product.category_id        = parseInt(category_id);
    if (product_name       !== undefined) product.product_name       = product_name;
    if (product_code       !== undefined) product.product_code       = product_code;
    if (description        !== undefined) product.description        = description;
    if (unit               !== undefined) product.unit               = unit;
    if (is_seasonal        !== undefined) product.is_seasonal        = is_seasonal;
    if (season_start_month !== undefined) product.season_start_month = season_start_month;
    if (season_end_month   !== undefined) product.season_end_month   = season_end_month;
    if (is_active          !== undefined) product.is_active          = is_active;

    await product.save();

    return res.json({ success: true, data: { product } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /admin/products/:id ───────────────────────────────
exports.deleteProduct = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const product = await db.Product.findByPk(req.params.id);
    if (!product) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ── Block if real business data exists ────────────────────
    const orderItemCount = await db.OrderItem.count({
      where: { product_id: product.product_id }, transaction: t,
    });
    const farmerCropCount = await db.FarmerCrop.count({
      where: { product_id: product.product_id }, transaction: t,
    });

    if (orderItemCount > 0 || farmerCropCount > 0) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Cannot delete this product because it is linked to existing orders or farmer crops.",
      });
    }

    // ── Safe to delete: wipe inventory + pricing first ────────
    const inventories = await db.Inventory.findAll({
      where: { product_id: product.product_id },
      attributes: ["inventory_id"],
      transaction: t,
    });
    const inventoryIds = inventories.map((i) => i.inventory_id);

    if (inventoryIds.length > 0) {
      await db.InventoryTransaction.destroy({
        where: { inventory_id: { [Op.in]: inventoryIds } },
        transaction: t,
      });
      await db.Inventory.destroy({
        where: { product_id: product.product_id },
        transaction: t,
      });
    }

    await db.Pricing.destroy({
      where: { product_id: product.product_id },
      transaction: t,
    });

    await product.destroy({ transaction: t });
    await t.commit();

    return res.json({ success: true, message: "Product deleted permanently" });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════════════════════════════

// ─── GET /admin/inventory ──────────────────────────────────────
exports.getAllInventory = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { grade, category_id } = req.query;

    const productWhere = { is_active: true };
    if (category_id) productWhere.category_id = parseInt(category_id);

    const inventoryWhere = {};
    if (grade) inventoryWhere.grade = grade;

    const { count, rows } = await db.Inventory.findAndCountAll({
      where: inventoryWhere,
      include: [
        {
          model: db.Product,
          as: "product",
          where: productWhere,
          attributes: ["product_id", "product_name", "product_code", "unit"],
          include: [
            { model: db.Category, as: "category", attributes: ["category_id", "category_name"] },
          ],
        },
      ],
      order:    [["last_restocked_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      success: true,
      data: {
        inventory: rows,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/inventory/low-stock ───────────────────────────
exports.getLowStockInventory = async (req, res) => {
  try {
    const rows = await db.Inventory.findAll({
      where: db.sequelize.literal("`Inventory`.`available_quantity_kg` < `Inventory`.`minimum_stock_alert`"),
      include: [
        {
          model: db.Product,
          as: "product",
          where: { is_active: true },
          attributes: ["product_id", "product_name", "product_code", "unit"],
          include: [
            { model: db.Category, as: "category", attributes: ["category_id", "category_name"] },
          ],
        },
      ],
      order: [["available_quantity_kg", "ASC"]],
    });

    return res.json({
      success: true,
      data: {
        count:     rows.length,
        inventory: rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /admin/inventory/:id ───────────────────────────────
// Update stock (stock_in | stock_out | adjustment | return | wastage)
// Auto-creates an inventory_transactions record
exports.updateInventory = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const inventory = await db.Inventory.findByPk(parseInt(req.params.id), { transaction: t });
    if (!inventory) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }

    const { transaction_type, quantity_kg, reference_type, reference_id, warehouse_location, minimum_stock_alert, remarks } = req.body;

    if (!transaction_type || !quantity_kg) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "transaction_type and quantity_kg are required" });
    }

    const previousQty = parseFloat(inventory.available_quantity_kg);
    let   newQty      = previousQty;

    // ─── Calculate new quantity based on type ─────────────────
    if (["stock_in", "return"].includes(transaction_type)) {
      newQty = previousQty + parseFloat(quantity_kg);
    } else if (["stock_out", "wastage"].includes(transaction_type)) {
      newQty = previousQty - parseFloat(quantity_kg);
      if (newQty < 0) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Insufficient stock for this operation" });
      }
    } else if (transaction_type === "adjustment") {
      // For adjustment, quantity_kg is the new absolute value
      newQty = parseFloat(quantity_kg);
    }

    // ─── Update inventory ─────────────────────────────────────
    const updateFields = { available_quantity_kg: newQty };
    if (warehouse_location  !== undefined) updateFields.warehouse_location  = warehouse_location;
    if (minimum_stock_alert !== undefined) updateFields.minimum_stock_alert = minimum_stock_alert;
    if (["stock_in", "return"].includes(transaction_type)) updateFields.last_restocked_at = new Date();

    await inventory.update(updateFields, { transaction: t });

    // ─── Create transaction record ────────────────────────────
    await db.InventoryTransaction.create({
      inventory_id:       inventory.inventory_id,
      transaction_type,
      quantity_kg:        parseFloat(quantity_kg),
      reference_type:     reference_type || "manual",
      reference_id:       reference_id   || null,
      previous_quantity:  previousQty,
      new_quantity:       newQty,
      performed_by:       req.user.user_id,
      remarks:            remarks || null,
    }, { transaction: t });

    await t.commit();

    return res.json({
      success: true,
      message: "Inventory updated successfully",
      data: {
        inventory_id:          inventory.inventory_id,
        previous_quantity_kg:  previousQty,
        new_quantity_kg:       newQty,
        transaction_type,
      },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/inventory/:id ──────────────────────────────────
exports.getInventoryById = async (req, res) => {
  try {
    const inventory = await db.Inventory.findByPk(req.params.id, {
      include: [
        {
          model: db.Product,
          as: "product",
          attributes: ["product_id", "product_name", "product_code", "unit"],
          include: [
            { model: db.Category, as: "category", attributes: ["category_id", "category_name"] },
          ],
        },
      ],
    });

    if (!inventory) {
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }

    return res.json({ success: true, data: { inventory } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/inventory/:id/transactions ─────────────────────
exports.getInventoryTransactions = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const inventory = await db.Inventory.findByPk(parseInt(req.params.id));
    if (!inventory) return res.status(404).json({ success: false, message: "Inventory record not found" });

    const { count, rows } = await db.InventoryTransaction.findAndCountAll({
      where: { inventory_id: inventory.inventory_id },
      include: [
        {
          model: db.User,
          as: "performed_user",
          attributes: ["user_id", "mobile_number", "email"],
        },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  PRICING
// ════════════════════════════════════════════════════════════════

// ─── GET /admin/pricing ────────────────────────────────────────
exports.getAllPricing = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { product_id, grade, is_active } = req.query;

    const where = {};
    if (product_id) where.product_id = parseInt(product_id);
    if (grade)      where.grade      = grade;
    if (is_active !== undefined) where.is_active = is_active === "true";

    const { count, rows } = await db.Pricing.findAndCountAll({
      where,
      include: [
        {
          model: db.Product,
          as: "product",
          attributes: ["product_id", "product_name", "product_code", "unit"],
          include: [
            { model: db.Category, as: "category", attributes: ["category_id", "category_name"] },
          ],
        },
      ],
      order:    [["product_id", "ASC"], ["grade", "ASC"], ["effective_from", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      success: true,
      data: {
        pricing: rows,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /admin/pricing ───────────────────────────────────────
// Upsert: update if product+grade combo exists, create if not
exports.upsertPricing = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const {
      product_id,
      grade,
      base_price_per_kg,
      wholesale_price_per_kg,
      retail_price_per_kg,
      minimum_order_kg,
      effective_from,
      effective_to,
      // inventory fields (required only when no inventory exists for this grade)
      available_quantity_kg,
      warehouse_location,
      minimum_stock_alert,
    } = req.body;

    const product = await db.Product.findByPk(parseInt(product_id), { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ─── Check if inventory exists for this product+grade ─────
    const existingInventory = await db.Inventory.findOne({
      where: { product_id: parseInt(product_id), grade },
      transaction: t,
    });

    if (!existingInventory) {
      // ─── Inventory details become required ───────────────────
      if (available_quantity_kg === undefined || available_quantity_kg === null) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `No inventory exists for grade "${grade}". Please provide available_quantity_kg (and optionally warehouse_location, minimum_stock_alert) to initialise it.`,
        });
      }

      await db.Inventory.create({
        product_id:            parseInt(product_id),
        grade,
        available_quantity_kg: parseFloat(available_quantity_kg),
        reserved_quantity_kg:  0,
        warehouse_location:    warehouse_location  || null,
        minimum_stock_alert:   minimum_stock_alert || 50,
      }, { transaction: t });
    }

    // ─── Upsert pricing ───────────────────────────────────────
    const [pricing, created] = await db.Pricing.findOrCreate({
      where:    { product_id: parseInt(product_id), grade },
      defaults: {
        base_price_per_kg,
        wholesale_price_per_kg,
        retail_price_per_kg:  retail_price_per_kg || null,
        minimum_order_kg:     minimum_order_kg    || 10,
        effective_from,
        effective_to:         effective_to        || null,
        is_active:            true,
        updated_by:           req.user.user_id,
      },
      transaction: t,
    });

    if (!created) {
      await pricing.update({
        base_price_per_kg,
        wholesale_price_per_kg,
        retail_price_per_kg:  retail_price_per_kg  !== undefined ? retail_price_per_kg  : pricing.retail_price_per_kg,
        minimum_order_kg:     minimum_order_kg     !== undefined ? minimum_order_kg     : pricing.minimum_order_kg,
        effective_from:       effective_from       !== undefined ? effective_from       : pricing.effective_from,
        effective_to:         effective_to         !== undefined ? effective_to         : pricing.effective_to,
        is_active:            true,
        updated_by:           req.user.user_id,
      }, { transaction: t });
    }

    await t.commit();

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Pricing created successfully" : "Pricing updated successfully",
      data:    { pricing },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /admin/pricing/:id (soft delete) ──────────────────
exports.deletePricing = async (req, res) => {
  try {
    const pricing = await db.Pricing.findByPk(parseInt(req.params.id));
    if (!pricing) return res.status(404).json({ success: false, message: "Pricing record not found" });

    await pricing.update({ is_active: false });

    return res.json({ success: true, message: "Pricing deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};