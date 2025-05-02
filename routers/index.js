const express = require("express");
const router = express.Router();
const registerRouter = require("./register.js");
const loginRouter = require("./login.js");
const passwordRouter = require("./passwords.js");
const verificationRouter = require("./verifications.js");
const customersRouter = require("./customers.js");

router.use("/register", registerRouter);
router.use("/login", loginRouter);
router.use("/passwords", passwordRouter);
router.use("/verifications", verificationRouter);
router.use("/customers", customersRouter);
module.exports = router;
