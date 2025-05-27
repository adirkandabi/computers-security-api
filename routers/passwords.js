const express = require("express");
const sql = require("mssql");
const router = express.Router();
const {
  hashPassword,
  validateUser,
  getPasswordPolicy,
} = require("../utils/auth.js");

router.get("/policy", (req, res) => {
  const policy = getPasswordPolicy();
  return res.status(200).json({
    success: true,
    policy,
  });
});
router.post("/change", async (req, res) => {
  try {
    const policy = getPasswordPolicy();
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
      let passwordError = "";
      if (new_password.length < policy.minLength) {
        passwordError = `Password must be at least ${policy.minLength} characters long.`;
      } else if (policy.requireUppercase && !/[A-Z]/.test(new_password)) {
        passwordError = "Password must contain at least one uppercase letter.";
      } else if (policy.requireLowercase && !/[a-z]/.test(new_password)) {
        passwordError = "Password must contain at least one lowercase letter.";
      } else if (policy.requireNumbers && !/[0-9]/.test(new_password)) {
        passwordError = "Password must contain at least one number.";
      } else if (
        policy.requireSpecialChars &&
        !/[^a-zA-Z0-9]/.test(new_password)
      ) {
        passwordError = "Password must contain at least one special character.";
      } else if (
        policy.dictionaryBlocklist.some((bad) => new_password.includes(bad))
      ) {
        passwordError = "Password contains a blocked word or phrase.";
      }
      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError,
        });
      }
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
        const historyCount = policy.historyCount;
        const historyPasswords = await pool
          .request()
          .input("userId", sql.NVarChar, user_id).query(`
            SELECT TOP ${historyCount} password_hash as password
            FROM PasswordHistory
            WHERE user_id = @userId
            ORDER BY created_at DESC
          `);
        const isInHistory = historyPasswords.recordset.some(
          (record) => record.password === hashedNewPassword
        );
        if (isInHistory) {
          return res.status(400).json({
            success: false,
            error_msg:
              "New password cannot be the same as the last " +
              historyCount +
              " passwords.",
          });
        }
        const result = await changePassword(
          user_id,
          hashedNewPassword,
          pool,
          user[0]["salt"]
        );
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
  const policy = getPasswordPolicy();
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
  let passwordError = "";
  if (new_password.length < policy.minLength) {
    passwordError = `Password must be at least ${policy.minLength} characters long.`;
  } else if (policy.requireUppercase && !/[A-Z]/.test(new_password)) {
    passwordError = "Password must contain at least one uppercase letter.";
  } else if (policy.requireLowercase && !/[a-z]/.test(new_password)) {
    passwordError = "Password must contain at least one lowercase letter.";
  } else if (policy.requireNumbers && !/[0-9]/.test(new_password)) {
    passwordError = "Password must contain at least one number.";
  } else if (policy.requireSpecialChars && !/[^a-zA-Z0-9]/.test(new_password)) {
    passwordError = "Password must contain at least one special character.";
  } else if (
    policy.dictionaryBlocklist.some((bad) => new_password.includes(bad))
  ) {
    passwordError = "Password contains a blocked word or phrase.";
  }
  if (passwordError) {
    return res.status(400).json({
      success: false,
      error: passwordError,
    });
  }
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

  const historyCount = policy.historyCount;
  const historyPasswords = await pool
    .request()
    .input("userId", sql.NVarChar, user_id).query(`
          SELECT TOP ${historyCount} password_hash as password
          FROM PasswordHistory
          WHERE user_id = @userId
          ORDER BY created_at DESC
        `);
  const isInHistory = historyPasswords.recordset.some(
    (record) => record.password === hashedNewPassword
  );
  if (isInHistory) {
    return res.status(400).json({
      success: false,
      error_msg:
        "New password cannot be the same as the last " +
        historyCount +
        " passwords.",
    });
  }

  const result = await changePassword(
    user_id,
    hashedNewPassword,
    pool,
    user[0]["salt"]
  );
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

async function changePassword(userId, newPassword, pool, salt) {
  try {
    const result = await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("newPassword", sql.NVarChar, newPassword).query(`UPDATE Users
          SET password=@newPassword
          WHERE user_id=@userId`);

    const result2 = await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("password_hash", sql.NVarChar, newPassword)
      .input("salt", sql.NVarChar, salt)
      .query(`INSERT INTO PasswordHistory (user_id, password_hash, salt)
          VALUES (@userId, @password_hash, @salt)`);
    return result.rowsAffected[0] > 0 && result2.rowsAffected[0] > 0;
  } catch (err) {
    console.log(err);
    return null;
  }
}

module.exports = router;
