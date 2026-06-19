const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "APOM Project APIs",
      version: "1.0.0",
      description:
        "Complete REST API for the APOM Farmer Application — covering authentication, farmer profiles, crops, orders, deliveries, vendors, inventory, payments, and admin reports.",
      contact: { name: "APOM Dev Team" },
    },
    servers: [
      { url: "http://172.16.0.227:5000/api", description: "Development Server" },
      { url: "https://api.apom.in/api",     description: "Production Server" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         "http",
          scheme:       "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Auth ────────────────────────────────────────────────
        RegisterRequest: {
          type: "object",
          required: ["mobile_number", "password", "role"],
          properties: {
            mobile_number: { type: "string", example: "9876543210" },
            password:      { type: "string", example: "SecurePass@123" },
            role:          { type: "string", enum: ["farmer", "vendor", "delivery"], example: "farmer" },
            email:         { type: "string", format: "email" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["mobile_number", "password"],
          properties: {
            mobile_number: { type: "string", example: "9876543210" },
            password:      { type: "string", example: "SecurePass@123" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            token:   { type: "string" },
            user:    { type: "object" },
          },
        },

        // ── Farmer ──────────────────────────────────────────────
        FarmerProfile: {
          type: "object",
          required: ["full_name", "aadhar_number", "location_address", "total_land_acres"],
          properties: {
            full_name:        { type: "string", example: "Ravi Kumar" },
            aadhar_number:    { type: "string", example: "123456789012" },
            farm_name:        { type: "string", example: "Green Fields Farm" },
            location_address: { type: "string" },
            city:             { type: "string" },
            district:         { type: "string" },
            state:            { type: "string" },
            pincode:          { type: "string" },
            latitude:         { type: "number" },
            longitude:        { type: "number" },
            total_land_acres: { type: "number", example: 5.5 },
          },
        },

        // ── Crop ────────────────────────────────────────────────
        FarmerCrop: {
          type: "object",
          required: ["partition_id", "product_id", "quantity_kg", "grade", "expected_price_per_kg"],
          properties: {
            partition_id:          { type: "string", format: "uuid" },
            product_id:            { type: "string", format: "uuid" },
            quantity_kg:           { type: "number", example: 100 },
            grade:                 { type: "string", enum: ["A", "B", "C"] },
            expected_price_per_kg: { type: "number", example: 25.5 },
            harvest_date:          { type: "string", format: "date" },
            is_ready:              { type: "boolean" },
            remarks:               { type: "string" },
          },
        },

        // ── Land Partition ──────────────────────────────────────
        LandPartition: {
          type: "object",
          required: ["partition_name", "area_acres"],
          properties: {
            partition_name:  { type: "string", example: "Field A" },
            area_acres:      { type: "number", example: 2.5 },
            soil_type:       { type: "string" },
            irrigation_type: { type: "string" },
            description:     { type: "string" },
          },
        },

        // ── Order ───────────────────────────────────────────────
        CreateOrder: {
          type: "object",
          required: ["items", "delivery_address", "final_amount"],
          properties: {
            delivery_address_id:  { type: "string", format: "uuid" },
            delivery_address:     { type: "string" },
            special_instructions: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["product_id", "quantity", "unit_price"],
                properties: {
                  product_id: { type: "string", format: "uuid" },
                  quantity:   { type: "number" },
                  unit_price: { type: "number" },
                },
              },
            },
          },
        },

        // ── Payment ─────────────────────────────────────────────
        Payment: {
          type: "object",
          properties: {
            order_id:       { type: "string", format: "uuid" },
            amount:         { type: "number" },
            payment_method: { type: "string", enum: ["cash", "upi", "bank_transfer", "cheque"] },
            transaction_id: { type: "string" },
          },
        },

        // ── Delivery Task ────────────────────────────────────────
        TaskStatusUpdate: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["accepted", "in_transit", "reached", "completed", "failed", "cancelled"],
            },
            actual_quantity_kg: { type: "number", description: "Required when status = completed" },
            delivery_notes:     { type: "string" },
            failure_reason:     { type: "string", description: "Required when status = failed" },
          },
        },
        OtpVerifyRequest: {
          type: "object",
          required: ["otp_code"],
          properties: {
            otp_code: { type: "string", example: "4821" },
          },
        },
        LocationUpdateRequest: {
          type: "object",
          required: ["latitude", "longitude"],
          properties: {
            latitude:    { type: "number", format: "float", example: 11.0168 },
            longitude:   { type: "number", format: "float", example: 76.9558 },
            delivery_id: { type: "integer", description: "Active task ID for GPS trail recording" },
          },
        },

        // ── Generic Responses ───────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data:    { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success:    { type: "boolean" },
            data:       { type: "array", items: {} },
            total:      { type: "integer" },
            page:       { type: "integer" },
            limit:      { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      // ── Admin ────────────────────────────────────────────────
      { name: "Admin Auth", description: "Admin account creation, login, and management" },
      { name: "Admin Farmers", description: "Farmer management" },
      { name: "Admin Vendors", description: "Vendor management" },
      { name: "Admin DeliveryPersonnel", description: "Delivery personnel management" },
      { name: "Admin Products", description: "Products, Category & Pricing management" },
      { name: "Admin Inventory", description: "Inventory management" },
      { name: "Admin Pricing", description: "Pricing management" },
      { name: "Admin Orders", description: "Orders management" },
      { name: "Admin PickupsDeliveries", description: "Pickups & Deliveries management" },
      { name: "Admin DeliveryRoutes", description: "Delivery Routes management" },      
      { name: "Admin Dashboard", description: "Dashboard management" },      
      { name: "Admin Dashboard - Charts", description: "Dashboard charts management" },      
      { name: "Admin Dashboard - Top Performers", description: "Dashboard Top performers management" },      
      { name: "Admin Commission Settings", description: "Comission management" },      
      { name: "Admin Audit Logs", description: "Audit Logs management" },      
      { name: "Admin Farmer Payouts", description: "Farmer payout management" },      
      { name: "Admin Notifications", description: "Notifications management" },      

      // ── Farmer ────────────────────────────────────────────────
      { name: "Farmer Auth",   description: "User registration, login, OTP verification" },
      { name: "Farmers",       description: "Farmer profile management" },
      { name: "Farmer Crops",  description: "Crop listing and management by farmers" },
      { name: "Farmer Land",   description: "Land partition management" },

      // ── Vendor ────────────────────────────────────────────────
      { name: "Vendor Auth",     description: "Vendor registration, login, OTP verification" },
      { name: "Vendor Home",     description: "Vendor dashboard data and counts" },
      { name: "Vendor Products", description: "Product catalogue APIs" },
      { name: "Vendor Cart",     description: "Shopping cart APIs" },
      { name: "Vendor Orders",   description: "Order lifecycle APIs" },

      // ── Delivery ──────────────────────────────────────────────
      { name: "Delivery Auth",     description: "Delivery person login and password management" },
      { name: "Delivery Home",     description: "Home screen stats and next task" },
      { name: "Delivery Tasks",    description: "Task list, detail, status updates, OTP verification, and proof photos — covers both PICKUP and DELIVERY task types" },
      { name: "Delivery Profile",  description: "Driver profile (GET/PUT), dashboard stats, and task history" },

      // ── Common ────────────────────────────────────────────────
      { name: "Location", description: "Location list" },

    ],
  },

  // Tell swagger-jsdoc where to find all @swagger JSDoc comments
  apis: [
    "./src/routes/*.js",
    "./src/routes/admin/*.js",
    "./src/routes/farmer/*.js",
    "./src/routes/vendor/*.js",
    "./src/routes/delivery/*.js",
    "./src/routes/common/*.js",    
  ],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;