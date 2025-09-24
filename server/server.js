import express from "express";
import cors from "cors";
import dotenv from "dotenv/config";
import mongoConnect from "./config/database.js";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./Inngest/index.js";
import showRouter from "./Routes/showrouter.js";
import bookingRouter from "./Routes/bookingrouter.js";
import adminRouter from "./Routes/adminrouter.js";
import userRouter from "./Routes/userrouter.js";
import { stripeWebhooks } from "./Control/Stripewebhooks.js";

const app = express();
const port = 3000;

// Connect to MongoDB
try {
  await mongoConnect();
  console.log("✅ MongoDB connection successful");
} catch (error) {
  console.error("❌ MongoDB connection failed:", error.message);
  process.exit(1);
}

// === SERVER STARTUP DEBUG ===
console.log("=== SERVER STARTUP DEBUG ===");
console.log("Current working directory:", process.cwd());
console.log("Environment Variables Status:");
console.log(
  "- TMDB_API_KEY:",
  process.env.TMDB_API_KEY
    ? `Present (${process.env.TMDB_API_KEY.substring(0, 8)}...)`
    : "MISSING!"
);
console.log(
  "- CLERK_PUBLISHABLE_KEY:",
  process.env.CLERK_PUBLISHABLE_KEY ? "Present" : "MISSING!"
);
console.log(
  "- CLERK_SECRET_KEY:",
  process.env.CLERK_SECRET_KEY ? "Present" : "MISSING!"
);
console.log("- MONGO_URI:", process.env.MONGO_URI ? "Present" : "MISSING!");
console.log("- NODE_ENV:", process.env.NODE_ENV || "Not set");
console.log("================================");

// Stripe webhook (must be before express.json())
app.post(
  "/api/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhooks
);

// Middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(
    "Request headers authorization:",
    req.headers.authorization ? "Present" : "Missing"
  );
  next();
});

// Routes
app.get("/", (req, res) => {
  res.send("Server is live!");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// Start server
const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log("Environment variables loaded:", {
    TMDB_API_KEY: !!process.env.TMDB_API_KEY,
    CLERK_KEYS: !!(
      process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
    ),
    MONGO_URI: !!process.env.MONGO_URI,
  });
});

// Handle server errors
server.on("error", (error) => {
  console.error("❌ Server failed to start:", error.message);
  process.exit(1);
});

// Test endpoints
app.get("/api/test", (req, res) => {
  console.log("TEST ENDPOINT CALLED");
  res.json({
    success: true,
    message: "Server is working!",
    timestamp: new Date().toISOString(),
    env: {
      tmdbKey: !!process.env.TMDB_API_KEY,
      clerkKey: !!process.env.CLERK_PUBLISHABLE_KEY,
    },
  });
});

// Test TMDB API endpoint
app.get("/api/test-tmdb", async (req, res) => {
  console.log("TESTING TMDB API CONNECTION...");
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    if (response.ok) {
      console.log(
        "TMDB API TEST SUCCESS - Got",
        data.results?.length,
        "movies"
      );
      res.json({
        success: true,
        message: "TMDB API working!",
        movieCount: data.results?.length,
        firstMovie: data.results?.[0]?.title,
      });
    } else {
      console.log("TMDB API ERROR:", data);
      res.json({ success: false, error: data });
    }
  } catch (error) {
    console.log("TMDB API TEST FAILED:", error.message);
    res.json({ success: false, error: error.message });
  }
});

// Main routes
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/show", showRouter);
app.use("/api/booking", bookingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// Listen at port : 3000
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log("Environment variables loaded:", {
    TMDB_API_KEY: !!process.env.TMDB_API_KEY,
    CLERK_KEYS:
      !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY,
    MONGO_URI: !!process.env.MONGO_URI,
  });
});

export default app;
