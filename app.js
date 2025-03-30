require("dotenv").config();
const express = require("express");
const routes = require("./routers/index.js");

const app = express();

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Use routes for API endpoint
app.use("/api", routes);

// Server listening on specified port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
