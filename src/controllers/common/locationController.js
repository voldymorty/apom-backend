// controllers/locationController.js
const db = require("../../models");

exports.getStates = async (req, res) => {
  try {
    const states = await db.State.findAll({
      attributes: ["state_id", "state_name", "state_code"],
      order: [["state_name", "ASC"]],
    });
    return res.json({ success: true, data: states });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDistricts = async (req, res) => {
  try {
    const { state_id, state_name } = req.query;
    if (!state_id && !state_name) {
      return res.status(400).json({ success: false, message: "state_id or state_name query param required" });
    }

    // If state_name provided, look up the state_id first
    let resolvedStateId = state_id;
    if (!resolvedStateId && state_name) {
      const state = await db.State.findOne({ where: { state_name } });
      if (!state) return res.status(404).json({ success: false, message: `State not found: ${state_name}` });
      resolvedStateId = state.state_id;
    }

    console.log("Querying districts with state_id:", resolvedStateId);

    const districts = await db.District.findAll({
      where: { state_id: resolvedStateId },
      attributes: ["district_id", "district_name", "state_id"],
      order: [["district_name", "ASC"]],
    });
    console.log("Districts found: ", districts.length);
    console.log("Sample district:", districts[0]?.toJSON());

    return res.json({ success: true, data: districts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCities = async (req, res) => {
  try {
    const { district_id, district_name } = req.query;
    if (!district_id && !district_name) {
      return res.status(400).json({ success: false, message: "district_id or district_name query param required" });
    }

    let resolvedDistrictId = district_id;
    if (!resolvedDistrictId && district_name) {
      const district = await db.District.findOne({ where: { district_name } });
      if (!district) return res.status(404).json({ success: false, message: `District not found: ${district_name}` });
      resolvedDistrictId = district.district_id;
    }

    const cities = await db.City.findAll({
      where: { district_id: resolvedDistrictId },
      attributes: ["city_id", "city_name", "district_id"],
      order: [["city_name", "ASC"]],
    });
    return res.json({ success: true, data: cities });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};