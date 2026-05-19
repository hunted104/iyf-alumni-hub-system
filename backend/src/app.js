const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const { errorHandler } = require("./middleware/error.middleware");

const app = express();

// ========================
// CORE MIDDLEWARE
// ========================
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ========================
// CORS (production-safe)
// ========================
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.CLIENT_URL, // important for deployment
    ],
    credentials: true,
  })
);

// ========================
// BASIC ROUTES
// ========================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running successfully",
  });
});

// KEEP ONLY ONE HEALTH ENDPOINT
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
  });
});

// ========================
// API ROUTES
// ========================
app.use("/api/auth", authRoutes);

// ========================
// 404 HANDLER
// ========================
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// ========================
// GLOBAL ERROR HANDLER
// ========================
app.use(errorHandler);

module.exports = app;
