require("dotenv").config();
const express = require("express");
const routes = require("./routers/index.js");
const db = require("./db/db");

const app = express();

(async () => {
  app.locals.dbPool = await db.getPool(); // Store the connection in app.locals
})();

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

app.use((req, res, next) => {
  req.dbPool = app.locals.dbPool;
  next();
});
// Use routes for API endpoint
app.use("/api", routes);

// Server listening on specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
