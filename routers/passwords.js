const express = require("express");
const { getPool } = require("../db/dbUtils.js");
const sql = require("mssql");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/change", async (req, res) => {
  try {
    const { password, new_password, user_id } = req.body;
    const missingFields = [];
    if (!password) missingFields.push("old password");
    if (!new_password) missingFields.push("new password");
    if (!user_id) missingFields.push("user id");
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error_msg: "Missing parameter: " + missingFields.join(","),
      });
    }
    const pool = await getPool();
    const user = await validateUser(user_id, pool);

    if (user === null) {
      return res
        .status(500)
        .json({ succuss: false, error_msg: "A general error occurred." });
    }
    if (!user.length) {
      return res
        .status(404)
        .json({ succuss: false, error_msg: "User not found." });
    } else {
      if (user[0]["password"] !== password) {
        return res
          .status(400)
          .json({ succuss: false, error_msg: "Incorrect old password." });
      } else if (user[0]["password"] === new_password) {
        return res.status(400).json({
          success: false,
          error_msg: "Current password and new password are the same.",
        });
      } else {
        const result = await changePassword(user_id, new_password, pool);
        if (result) {
          return res.status(200).json({ succuss: true });
        } else if (result === false) {
          return res
            .status(404)
            .json({ succuss: false, error_msg: "User not found." });
        } else {
          return res
            .status(500)
            .json({ succuss: false, error_msg: "A general error occurred" });
        }
      }
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ succuss: false, error_msg: "Internal server error." });
  }
});
router.post("/reset", async (req, res) => {
  const email = req.body.email;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, error_msg: "Email is required." });
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // use SSL
    auth: {
      user: "kandabiadir@gmail.com",
      pass: "dmqltboslazgzmwx",
    },
  });
  const mailOptions = {
    from: "noreplay@comunication-ltd.com",
    to: email,
    subject: `Test`,
    text: `
        reset password testing
      `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error while sending email:", error);
      return res.status(500).send(error.toString());
    }
    res.status(200).send("Email sent: " + info.response);
  });
});

router.post("/", async (req, res) => {
  return res.status(404).json({ success: false, error_msg: "Page Not Found" });
});
async function changePassword(userId, newPassword, pool) {
  try {
    const result = await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("newPassword", sql.NVarChar, newPassword).query(`UPDATE Users
          SET password=@newPassword
          WHERE user_id=@userId`);
    console.log(result);
    return result.rowsAffected[0] > 0;
  } catch (err) {
    console.log(err);
    return null;
  }
}
async function validateUser(userId, pool) {
  try {
    const result = await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .query("SELECT * FROM Users WHERE user_id=@userId");
    return result.recordset;
  } catch (err) {
    console.log(err);
    return null;
  }
}

module.exports = router;
