const express = require("express");
const cors = require("cors");
const path = require("path");
const PropertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion } = require("mongodb");

// Initialize Express app
const app = express();
app.use(cors()); // Restrict CORS for production
app.use(express.json());
app.set("json spaces", 3);

// Load properties
const propertiesPath = path.resolve(__dirname, "./db.properties");
const properties = PropertiesReader(propertiesPath);

// Extract DB config
const dbPrefix = properties.get("db.prefix");
const dbHost = properties.get("db.host");
const dbName = properties.get("db.name");
const dbUser = properties.get("db.user");
const dbPassword = properties.get("db.password");
const dbParams = properties.get("db.params");

// MongoDB URI and Client
const uri = `${dbPrefix}${dbUser}:${encodeURIComponent(dbPassword)}${dbHost}${dbParams}`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let db1; // Declare global variable for DB

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    db1 = client.db(dbName); // Set database reference
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit if DB connection fails
  }
}

connectDB();

// Middleware to load collection dynamically
app.param("collectionName", (req, res, next, collectionName) => {
  try {
    req.collection = db1.collection(collectionName);
    console.log("Middleware set collection:", req.collection.collectionName);
    next();
  } catch (err) {
    console.error("Invalid collection:", err.message);
    next(err);
  }
});

// Serve static file
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "index.html"));
// });

// Route to fetch lessons
app.get("/lessons", async (req, res, next) => {
  try {
    const lessons = await db1.collection("Lessons").find({}).toArray();
    console.log("Retrieved lessons:", lessons);
    res.json(lessons);
  } catch (err) {
    console.error("Error fetching lessons:", err.message);
    next(err);
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ error: "An internal server error occurred" });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
