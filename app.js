require("dotenv").config();
const express = require("express");
const routes = require("./routers/index.js");
const db = require("./db/db");
const cors = require("cors");

const app = express();

(async () => {
  app.locals.dbPool = await db.getPool(); // Store the connection in app.locals
})();
// Enable CORS for all origins
app.use(cors());

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Use routes for API endpoint
app.use("/api", routes);

// Server listening on specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
