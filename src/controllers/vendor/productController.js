const { Op } = require("sequelize");
const db = require("../../models");

// ─── GET /vendor/products ──────────────────────────────────────
// Query params:
//   category_id     - filter by category
//   search          - search by product_name
//   sort            - price_asc | price_desc | recommended (default)
//   grade           - A | B | C (filter by grade)
//   page            - pagination (default 1)
//   limit           - items per page (default 20)
exports.getProducts = async (req, res) => {
  try {
    const {
      category_id,
      search,
      sort = "recommended",
      grade,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const productWhere = { is_active: true };
    if (category_id) productWhere.category_id = parseInt(category_id);
    if (search?.trim()) {
      productWhere.product_name = { [Op.like]: `%${search.trim()}%` };
    }

    const pricingWhere = { is_active: true };
    const gradeFilterActive = grade && ["A", "B", "C"].includes(grade);
    if (gradeFilterActive) pricingWhere.grade = grade;

    // Fetch without DB-level price sort first (Sequelize can't sort
    // by association column at the top level without a literal)
    const products = await db.Product.findAndCountAll({
      where: productWhere,
      include: [
        {
          model: db.Category,
          as: "category",
          attributes: ["category_id", "category_name", "image_url"],
        },
        {
          model: db.Pricing,
          as: "pricing",
          where: pricingWhere,
          required: gradeFilterActive, // true when filtering by grade
          attributes: [
            "pricing_id", "grade",
            "base_price_per_kg", "wholesale_price_per_kg", "retail_price_per_kg",
            "minimum_order_kg", "is_active",
          ],
        },
        {
          model: db.Inventory,
          as: "inventory",
          required: false,
          attributes: ["available_quantity_kg", "reserved_quantity_kg", "grade"],
        },
      ],
      // For recommended, sort by name at DB level
      order: sort === "recommended" ? [["product_name", "ASC"]] : [["product_name", "ASC"]],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // Map to result shape
    let result = products.rows.map((p) => {
      const pricings = p.pricing || [];
      const startingPrice = pricings.length
        ? Math.min(...pricings.map(x => parseFloat(x.wholesale_price_per_kg)))
        : null;

      return {
        product_id: p.product_id,
        product_name: p.product_name,
        description: p.description,
        unit: p.unit,
        image_url: p.image_url,
        category_id: p.category?.category_id,
        category_name: p.category?.category_name,
        grades: pricings.map(x => x.grade),
        starting_price: startingPrice,
        in_stock: (p.inventory || []).some(x => {
          const avail = parseFloat(x.available_quantity_kg || 0);
          const reserved = parseFloat(x.reserved_quantity_kg || 0);
          return (avail - reserved) > 0;
        }),
      };
    });

    // Apply price sort in JS after mapping (starting_price is now available)
    if (sort === "price_asc") {
      result.sort((a, b) => (a.starting_price ?? Infinity) - (b.starting_price ?? Infinity));
    } else if (sort === "price_desc") {
      result.sort((a, b) => (b.starting_price ?? -Infinity) - (a.starting_price ?? -Infinity));
    }

    return res.json({
      success: true,
      data: {
        products: result,
        pagination: {
          total: products.count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(products.count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /vendor/products/categories ──────────────────────────
// Returns all active categories for the category chip filter
exports.getCategories = async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      where: { is_active: true },
      attributes: ["category_id", "category_name", "image_url", "icon_url", "display_order"],
      order: [["display_order", "ASC"], ["category_name", "ASC"]],
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /vendor/products/:product_id ─────────────────────────
// Returns full product details with all grade pricings
exports.getProductDetail = async (req, res) => {
  try {
    const { product_id } = req.params;

    const product = await db.Product.findOne({
      where: { product_id, is_active: true },
      include: [
        {
          model: db.Category,
          as: "category",
          attributes: ["category_id", "category_name"],
        },
        {
          model: db.Pricing,
          as: "pricing",
          where: { is_active: true },
          required: false,
          attributes: [
            "pricing_id", "grade",
            "base_price_per_kg", "wholesale_price_per_kg", "retail_price_per_kg",
            "minimum_order_kg",
          ],
        },
        {
      model: db.Inventory,     // ← add this
      as: "inventory",
      required: false,
      attributes: ["grade", "available_quantity_kg", "reserved_quantity_kg"],
    },
      ],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      data: {
        product_id:   product.product_id,
        product_name: product.product_name,
        description:  product.description,
        unit:         product.unit,
        image_url:    product.image_url,
        category:     product.category,
        
       grades: (product.pricing || []).map((pr) => {
          const inv = (product.inventory || []).find((i) => i.grade === pr.grade);
          const rawAvailable = parseFloat(inv?.available_quantity_kg || 0);
          const reserved = parseFloat(inv?.reserved_quantity_kg || 0);
          const available_kg = Math.max(0, rawAvailable - reserved);

          return {
            pricing_id:          pr.pricing_id,
            grade:               pr.grade,
            tag:                 `GRADE ${pr.grade}`,
            price_per_kg:        parseFloat(pr.wholesale_price_per_kg),
            retail_price_per_kg: parseFloat(pr.retail_price_per_kg || 0),
            minimum_order_kg:    parseFloat(pr.minimum_order_kg || 0),
            available_kg:        available_kg,
            in_stock:            available_kg > 0,
          };
        })
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Helper ────────────────────────────────────────────────────
function formatProduct(product, pricing) {
  // Match inventory row for this specific grade
  const inv = (product.inventory || []).find(
    (i) => i.grade === pricing?.grade
  );
  const available_kg = parseFloat(inv?.available_quantity_kg || 0);

  return {
    product_id:           product.product_id,
    product_name:         product.product_name,
    description:          product.description,
    unit:                 product.unit,
    image_url:            product.image_url,
    category_id:          product.category_id,
    category_name:        product.category?.category_name || null,
    grade:                pricing?.grade || null,
    tag:                  pricing ? `GRADE ${pricing.grade}` : null,
    price_per_unit:       pricing ? parseFloat(pricing.wholesale_price_per_kg) : null,
    minimum_order_kg:     pricing ? parseFloat(pricing.minimum_order_kg || 0) : null,
    pricing_id:           pricing?.pricing_id || null,
    // ── Stock ──
    available_kg:         available_kg,
    in_stock:             available_kg > 0,
  };
}
