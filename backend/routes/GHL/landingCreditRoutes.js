const express = require("express");
const {
  createLandingCreditApplication,
} = require("../../controllers/GHL/landingCreditController");
const {
  publicLandingRateLimit,
  requireSmallJsonRequest,
} = require("../../middleware/publicLandingProtection");

const router = express.Router();

router.post(
  "/",
  requireSmallJsonRequest,
  publicLandingRateLimit,
  createLandingCreditApplication,
);

module.exports = router;
