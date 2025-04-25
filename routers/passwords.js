const express = require("express");
const sql = require("mssql");
const router = express.Router();
const { hashPassword, validateUser } = require("../utils/auth.js");

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
    const pool = req.app.locals.dbPool;
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
      const secretKey = process.env.SECRET_KEY;
      const hashedOldPassword = hashPassword(
        password,
        user[0]["salt"],
        secretKey
      );
      const hashedNewPassword = hashPassword(
        new_password,
        user[0]["salt"],
        secretKey
      );
      if (user[0]["password"] !== hashedOldPassword) {
        return res
          .status(400)
          .json({ succuss: false, error_msg: "Incorrect old password." });
      } else if (user[0]["password"] === hashedNewPassword) {
        return res.status(400).json({
          success: false,
          error_msg: "Current password and new password are the same.",
        });
      } else {
        const result = await changePassword(user_id, hashedNewPassword, pool);
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
  const { new_password, user_id } = req.body;
  if (!new_password) {
    return res
      .status(400)
      .json({ success: false, error_msg: "Missing password (new_password)" });
  }
  if (!user_id) {
    return res
      .status(400)
      .json({ success: false, error_msg: "Missing user ID (user_id)" });
  }

  const pool = req.app.locals.dbPool;
  const userVerifiedCode = await isVerifiedCode(user_id, pool);
  if (userVerifiedCode === null) {
    return res
      .status(500)
      .json({ success: false, error_msg: "Problem with checking the data" });
  } else if (userVerifiedCode === false) {
    return res
      .status(200)
      .json({ success: false, error_msg: "User has not verified the code" });
  }
  const user = await validateUser(user_id, pool);
  const secretKey = process.env.SECRET_KEY;
  if (user === null) {
    return res
      .status(500)
      .json({ succuss: false, error_msg: "A general error occurred." });
  }
  if (!user.length) {
    return res
      .status(404)
      .json({ succuss: false, error_msg: "User not found." });
  }
  const hashedNewPassword = hashPassword(
    new_password,
    user[0]["salt"],
    secretKey
  );
  const result = await changePassword(user_id, hashedNewPassword, pool);
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
});
router.post("/", async (req, res) => {
  return res.status(404).json({ success: false, error_msg: "Page Not Found." });
});
async function isVerifiedCode(userId, pool) {
  try {
    const result = await pool.request().input("userId", sql.NVarChar, userId)
      .query(`
      SELECT *
      FROM VerificationCodes
      WHERE user_id = @userId
        AND is_used = 1
        AND DATEADD(MINUTE, 5, CAST(verified_at AS DATETIMEOFFSET)) > SYSDATETIMEOFFSET() AT TIME ZONE 'Israel Standard Time'
    `);
    return result.recordset.length > 0;
  } catch (ex) {
    console.log(ex);
    return null;
  }
}

async function changePassword(userId, newPassword, pool) {
  try {
    const result = await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("newPassword", sql.NVarChar, newPassword).query(`UPDATE Users
          SET password=@newPassword
          WHERE user_id=@userId`);
    return result.rowsAffected[0] > 0;
  } catch (err) {
    console.log(err);
    return null;
  }
}

module.exports = router;
