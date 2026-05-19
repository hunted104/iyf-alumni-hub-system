const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Attempting MongoDB connection...");

    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/iyf-alumni-connect";

    if (!process.env.MONGO_URI) {
      console.warn("Warning: MONGO_URI not set. Falling back to mongodb://localhost:27017/iyf-alumni-connect");
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds hard fail
    });

    console.log("MongoDB Connected successfully");
  } catch (error) {
    console.error("MongoDB connection FAILED:"); for 
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
