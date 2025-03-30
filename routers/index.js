const express = require("express");
const router = express.Router();
const registerRouter = require("./register.js");
const loginRouter = require("./login.js");
const passwordRouter = require("./passwords.js");

router.use("/register", registerRouter);
router.use("/login", loginRouter);
router.use("/passwords", passwordRouter);
module.exports = router;
