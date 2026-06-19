// index.js

const sequelize = require("../config/database");

const User = require("./user");
const OtpVerification = require("./otpVerification");
const Farmer = require("./farmer");
const FarmerCrop = require("./farmerCrop");
const FarmerEarning = require("./farmerEarning");
const Vendor = require("./vendor");
const VendorAddress = require("./vendorAddress");
const DeliveryPersonnel = require("./deliveryPersonnel");
const Category = require("./category");
const Product = require("./product");
const Inventory = require("./inventory");
const InventoryTransaction = require("./inventoryTransaction");
const Pricing = require("./pricing");
const Order = require("./order");
const OrderItem = require("./orderItem");
const Payment = require("./payment");
const CommissionSetting = require("./commissionSetting");
const PickupDelivery = require("./pickupDelivery");
const DeliveryStatusHistory = require("./deliveryStatusHistory");
const DeliveryRoute = require("./deliveryRoute");
const Notification = require("./notification");
const AuditLog = require("./auditLog");
const DailyReport = require("./dailyReport");
const FarmerBankDetails = require("./farmerBankDetails");
const State    = require("./state");
const District = require("./district");
const City     = require("./city");
const LandSegment     = require("./landSegment");
const MarketDemand = require("./marketDemand");

const db = {};

db.sequelize = sequelize;

db.User = User;
db.OtpVerification = OtpVerification;
db.Farmer = Farmer;
db.FarmerCrop = FarmerCrop;
db.FarmerEarning = FarmerEarning;
db.Vendor = Vendor;
db.VendorAddress = VendorAddress;
db.DeliveryPersonnel = DeliveryPersonnel;
db.Category = Category;
db.Product = Product;
db.Inventory = Inventory;
db.InventoryTransaction = InventoryTransaction;
db.Pricing = Pricing;
db.Order = Order;
db.OrderItem = OrderItem;
db.Payment = Payment;
db.CommissionSetting = CommissionSetting;
db.PickupDelivery = PickupDelivery;
db.DeliveryStatusHistory = DeliveryStatusHistory;
db.DeliveryRoute = DeliveryRoute;
db.Notification = Notification;
db.AuditLog = AuditLog;
db.DailyReport = DailyReport;
db.FarmerBankDetails = FarmerBankDetails;
db.State    = State;
db.District = District;
db.City     = City;
db.LandSegment = LandSegment;
db.MarketDemand = MarketDemand;

// One user -> one farmer profile
User.hasOne(Farmer, { foreignKey: "user_id", as: "farmer", onDelete: "CASCADE"});

Farmer.belongsTo(User, { foreignKey: "user_id", as: "user"});

// Farmer → Land Segment
Farmer.hasMany(LandSegment, { foreignKey: "farmer_id", as: "land_segments", onDelete: "CASCADE"});

LandSegment.belongsTo(Farmer, { foreignKey: "farmer_id", as: "farmer"});

Farmer.hasMany(FarmerCrop, { foreignKey: "farmer_id", as: "crops"});

FarmerCrop.belongsTo(Farmer, { foreignKey: "farmer_id", as: "farmer"});

LandSegment.hasMany(FarmerCrop, { foreignKey: "segment_id", as: "crops"});

FarmerCrop.belongsTo(LandSegment, { foreignKey: "segment_id", as: "segment"});

Product.hasMany(FarmerCrop, { foreignKey: "product_id", as: "farmer_crops"});

FarmerCrop.belongsTo(Product, { foreignKey: "product_id", as: "product"});

Farmer.hasMany(FarmerEarning, { foreignKey: "farmer_id", as: "earnings" });

FarmerEarning.belongsTo(Farmer, { foreignKey: "farmer_id", as: "farmer" });

FarmerCrop.hasMany(FarmerEarning, { foreignKey: "crop_id", as: "earnings" });

FarmerEarning.belongsTo(FarmerCrop, { foreignKey: "crop_id", as: "crop" });

PickupDelivery.hasMany(FarmerEarning, { foreignKey: "pickup_delivery_id", as: "farmer_earnings" });

FarmerEarning.belongsTo(PickupDelivery, { foreignKey: "pickup_delivery_id", as: "pickup_delivery" });

User.hasOne(Vendor, { foreignKey: "user_id", as: "vendor" });

Vendor.belongsTo(User, { foreignKey: "user_id", as: "user" });

Vendor.hasMany(VendorAddress, { foreignKey: "vendor_id", as: "addresses" });

VendorAddress.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });

Vendor.belongsTo(State,    { foreignKey: "state_id",    as: "state_info" });
Vendor.belongsTo(District, { foreignKey: "district_id", as: "district_info" });
Vendor.belongsTo(City,     { foreignKey: "city_id",     as: "city_info" });

User.hasOne(DeliveryPersonnel, { foreignKey: "user_id", as: "delivery_profile" });

DeliveryPersonnel.belongsTo(User, { foreignKey: "user_id", as: "user" });

Category.hasMany(Product, { foreignKey: "category_id", as: "products" });

Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

Inventory.belongsTo(Product, { foreignKey: "product_id", as: "product" });

Inventory.hasMany(InventoryTransaction, { foreignKey: "inventory_id", as: "transactions" });

InventoryTransaction.belongsTo(Inventory, { foreignKey: "inventory_id", as: "inventory" });

User.hasMany(InventoryTransaction, { foreignKey: "performed_by", as: "inventory_actions" });

InventoryTransaction.belongsTo(User, { foreignKey: "performed_by", as: "performed_user" });

Product.hasMany(Pricing, { foreignKey: "product_id", as: "pricing" });

Product.hasMany(Inventory, { foreignKey: "product_id", as: "inventory" });

Pricing.belongsTo(Product, { foreignKey: "product_id", as: "product" });

User.hasMany(Pricing, { foreignKey: "updated_by", as: "updated_pricing" });

Pricing.belongsTo(User, { foreignKey: "updated_by", as: "updated_user" });

Vendor.hasMany(Order, { foreignKey: "vendor_id", as: "orders" });

Order.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });

VendorAddress.hasMany(Order, { foreignKey: "delivery_address_id", as: "orders" });

Order.belongsTo(VendorAddress, { foreignKey: "delivery_address_id", as: "delivery_address_details" });

User.hasMany(Order, { foreignKey: "cancelled_by", as: "cancelled_orders" });

Order.belongsTo(User, { foreignKey: "cancelled_by", as: "cancelled_user" });

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });

OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Product.hasMany(OrderItem, { foreignKey: "product_id", as: "order_items" });

OrderItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

Order.hasMany(Payment, { foreignKey: "order_id", as: "payments" });

Payment.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Vendor.hasMany(Payment, { foreignKey: "vendor_id", as: "payments" });

Payment.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });

User.hasMany(CommissionSetting, { foreignKey: "created_by", as: "commission_settings_created" });

CommissionSetting.belongsTo(User, { foreignKey: "created_by", as: "creator" });

Farmer.hasMany(PickupDelivery, { foreignKey: "farmer_id", as: "pickups" });

PickupDelivery.belongsTo(Farmer, { foreignKey: "farmer_id", as: "farmer" });

FarmerCrop.hasMany(PickupDelivery, { foreignKey: "crop_id", as: "deliveries" });

PickupDelivery.belongsTo(FarmerCrop, { foreignKey: "crop_id", as: "crop" });

Order.hasMany(PickupDelivery, { foreignKey: "order_id", as: "deliveries" });

PickupDelivery.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Vendor.hasMany(PickupDelivery, { foreignKey: "vendor_id", as: "deliveries" });

PickupDelivery.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });

DeliveryPersonnel.hasMany(PickupDelivery, { foreignKey: "delivery_person_id", as: "assignments" });

PickupDelivery.belongsTo(DeliveryPersonnel, { foreignKey: "delivery_person_id", as: "delivery_person" });

DeliveryRoute.hasMany(PickupDelivery, { foreignKey: "route_id", as: "deliveries" });

PickupDelivery.belongsTo(DeliveryRoute, { foreignKey: "route_id", as: "route" });

User.hasMany(PickupDelivery, { foreignKey: "assigned_by", as: "assigned_deliveries" });

PickupDelivery.belongsTo(User, { foreignKey: "assigned_by", as: "assigned_user" });

PickupDelivery.hasMany(DeliveryStatusHistory, { foreignKey: "delivery_id", as: "status_history" });

DeliveryStatusHistory.belongsTo(PickupDelivery, { foreignKey: "delivery_id", as: "delivery" });

User.hasMany(DeliveryStatusHistory, { foreignKey: "changed_by", as: "delivery_status_updates" });

DeliveryStatusHistory.belongsTo(User, { foreignKey: "changed_by", as: "changed_user" });

DeliveryPersonnel.hasMany(DeliveryRoute, { foreignKey: "delivery_person_id", as: "routes" });

DeliveryRoute.belongsTo(DeliveryPersonnel, { foreignKey: "delivery_person_id", as: "delivery_person" });

User.hasMany(DeliveryRoute, { foreignKey: "created_by", as: "created_routes" });

DeliveryRoute.belongsTo(User, { foreignKey: "created_by", as: "creator" });

User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });

Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(AuditLog, { foreignKey: "user_id", as: "audit_logs" });

AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

Farmer.hasOne(FarmerBankDetails, { foreignKey: "farmer_id", as: "bank_details" });

FarmerBankDetails.belongsTo(Farmer, { foreignKey: "farmer_id", as: "farmer" });

// State → Districts
State.hasMany(District, { foreignKey: "state_id", as: "districts", onDelete: "CASCADE" });
District.belongsTo(State, { foreignKey: "state_id", as: "state" });

// District → Cities
District.hasMany(City, { foreignKey: "district_id", as: "cities", onDelete: "CASCADE" });
City.belongsTo(District, { foreignKey: "district_id", as: "district" });

// Farmer → Land Segments

Farmer.belongsTo(State,    { foreignKey: "state_id",    as: "state_info" });
Farmer.belongsTo(District, { foreignKey: "district_id", as: "district_info" });
Farmer.belongsTo(City,     { foreignKey: "city_id",     as: "city_info" });

module.exports = db;