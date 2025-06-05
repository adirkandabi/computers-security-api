const express = require("express");
const crypto = require("crypto");
const sql = require("mssql");
const nodemailer = require("nodemailer");
const router = express.Router();
const { validateUser } = require("../utils/auth.js");
router.post("/send-code", async (req, res) => {
  const email = req.body.email;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, error_msg: "Email is required." });
  }

  const pool = req.app.locals.dbPool;

  const user = await validateUser(email, pool);
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
  const randomValue = generateSHA1();

  if (!(await insertCodeToDB(randomValue, user[0].user_id, pool))) {
    return res
      .status(500)
      .send({ success: false, error_msg: "Promblem with sending the data." });
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
    to: email,
    subject: `Communication LTD - Reset your password`,
    html: `
      <table role="presentation" width="100%" height="50%" cellspacing="0" cellpadding="0" border="0">
          <tr>
              <td align="center" valign="middle" style="height:100vh;">
                  <div style="text-align:center; padding:60px;margin-top:-20rem;border:1px solid #ddd; border-radius:10px; max-width:400px;">
                      <p style="font-size:20px;">Your verification code is:</p>
                      <p style="font-size:25px;font-weight:bold;">${randomValue}</p>
                      <p>Please enter it in the app.</p>
                  </div>
              </td>
          </tr>
      </table>
  `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error while sending email:", error);
      return res
        .status(500)
        .send({ success: false, error_msg: "Could not send the email." });
    }
    res.status(200).send({
      success: true,
      user_id: user[0].user_id,
      info: "Successfully sent the verification code.",
    });
  });
});

router.post("/verify", async (req, res) => {
  const { code, user_id } = req.body;
  const missingFields = [];
  if (!code) {
    missingFields.push("verification code");
  }
  if (!user_id) {
    missingFields.push("user id");
  }
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error_msg: "Missing fields: " + missingFields.join(", "),
    });
  }
  const pool = req.app.locals.dbPool;
  const isCodeVerified = await verifyCode(user_id, code, pool);
  if (isCodeVerified) {
    return res.status(200).json({ success: true });
  } else if (isCodeVerified === false) {
    return res.status(400).json({
      success: false,
      error_msg: "Incorrect or invalid verification code.",
    });
  } else {
    return res
      .status(500)
      .json({ success: false, error_msg: "Problem with checking the data" });
  }
});

router.post("/", async (req, res) => {
  return res.status(404).json({ success: false, error_msg: "Page Not Found." });
});

async function verifyCode(userId, code, pool) {
  try {
    const result = await pool
        .request()
        .input("code", sql.NVarChar, code)
        .input("userId", sql.NVarChar, userId).query(`
                  ;WITH Latest AS (
            SELECT TOP 1 verification_code
            FROM VerificationCodes
            WHERE user_id = @userId
            ORDER BY created_at DESC
          )
          UPDATE VerificationCodes
          SET is_used = 1,
              verified_at = SYSDATETIMEOFFSET() AT TIME ZONE 'Israel Standard Time'
          WHERE verification_code = @code
            AND user_id = @userId
            AND is_used = 0
            AND SYSDATETIMEOFFSET() AT TIME ZONE 'Israel Standard Time' <= expiration_time
            AND verification_code = (SELECT verification_code FROM Latest);
           `);
    if (result.rowsAffected[0] === 1) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.log("Database error:", err);
    return null;
  }
}
async function insertCodeToDB(code, userId, pool) {
  try {
    const result = await pool
      .request()
      .input("code", sql.NVarChar, code)
      .input("userId", sql.NVarChar, userId)
      .query(`INSERT INTO VerificationCodes (user_id, verification_code, expiration_time)
                        VALUES (@userId, @code, DATEADD(MINUTE, 10, SYSDATETIMEOFFSET() AT TIME ZONE 'Israel Standard Time'))`);

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

function generateSHA1() {
  const randomValue = crypto.randomBytes(20).toString("hex"); // Generate 20 random bytes
  return crypto.createHash("sha1").update(randomValue).digest("hex");
}
module.exports = router;
