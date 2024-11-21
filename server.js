const express = require("express");
const cors = require("cors");
const path = require("path");
const PropertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const winston = require("winston"); // Structured logging

// Initialize Express app
const app = express();
app.use(cors({
  origin: 'https://fullstack-backend-s1kh.onrender.com/', // Your GitHub Pages link
  methods: 'GET,POST,PUT,DELETE', // Allowed HTTP methods
  allowedHeaders: 'Content-Type' // Allowed headers
})); // Restrict CORS for production
app.use(express.json());
app.set("json spaces", 3);

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ]
});

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
    logger.info("Connected to MongoDB");
    db1 = client.db(dbName); // Set database reference
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    process.exit(1); // Exit if DB connection fails
  }
}

connectDB();

// Middleware for logging request details
app.use((req, res, next) => {
  const time = new Date().toISOString();
  logger.info(`${req.method} ${req.url} - ${time}`);
  next();
});

// Middleware to load collection dynamically
app.param("collectionName", (req, res, next, collectionName) => {
  try {
    req.collection = db1.collection(collectionName);
    logger.info("Middleware set collection:", req.collection.collectionName);
    next();
  } catch (err) {
    logger.error("Invalid collection:", err.message);
    next(err);
  }
});
app.get("/",(req,res) =>{
  res.send("welcome to our homepage");
});

// Static file serving
const imagePath = path.resolve(process.cwd(), 'images');
app.use('/images', express.static(imagePath, { fallthrough: true }));
app.use('/images', (req, res) => {
  res.status(404).json({ error: 'Image not found' });
});

// Route to fetch lessons
app.get("/lessons", async (req, res, next) => {
  try {
    const lessons = await db1.collection("Lessons").find({}).toArray();
    logger.info("Retrieved lessons:", lessons);
    res.json(lessons);
  } catch (err) {
    logger.error("Error fetching lessons:", err.message);
    next(err);
  }
});

// Endpoint to get all orders from a collection
app.get('/orders', async (req, res, next) => {
  try {
    const orders = await db1.collection('Orders').find({}).toArray();
    res.json(orders);
    logger.info('Displaying data in the Orders Collection');
  } catch (error) {
    logger.error('Failed to fetch orders:', error.message);
    next(error); // Delegate to global error handler
  }
});

// Posting a new order into the database
app.post('/order', async (req, res) => {
  try {
      const orderData = req.body;

      const lessons = orderData.lessons.map(lesson => ({
          lessonID: lesson.lessonID,
          spaces: lesson.spaces
      }));

      const order = {
          name: orderData.name,
          phone: orderData.phone,
          lessons: lessons,
          totalPrice: orderData.totalPrice,
      };

      const result = await db1.collection('Orders').insertOne(order);

      res.json({ insertedId: result.insertedId });
  } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: "Failed to create order" });
  }
});

// Update order by orderNo
app.put('/order/:orderNo', async (req, res, next) => {
  try {
    const { orderNo } = req.params;
    const result = await db1.collection('Orders').updateOne(
      { orderNo: parseInt(orderNo) },
      { $set: req.body }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    logger.info("Updated an order successfully");
    res.json(result);
  } catch (error) {
    logger.error("Failed to update order:", error.message);
    next(error);
  }
});

// Update lesson program by id
// Update a lesson by id (using ObjectId for _id)
app.put('/lessons/:id', async (req, res, next) => {
  try {
    const { id } = req.params;  // Get the lesson's id from the URL
    const updateData = req.body;  // The data sent in the request body (e.g., availability)

    // Ensure that the ID is valid and use it for MongoDB's _id field
    const lessonObjectId = new ObjectId(id);

    // Update the lesson document
    const result = await db1.collection('Lessons').updateOne(
      { _id: lessonObjectId },  // Find the lesson by ObjectId
      { $set: updateData }       // Set the updated data
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    logger.info("Updated the lesson successfully");
    res.json(result);  // Return the result of the update
  } catch (error) {
    logger.error("Failed to update lesson:", error.message);
    next(error);  // Pass the error to the next middleware
  }
});


// Global Error Handler
app.use((err, req, res, next) => {
  logger.error("Global error handler:", err);
  res.status(500).json({ error: "An internal server error occurred" });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await client.close();
  logger.info("MongoDB connection closed");
  process.exit(0);
});

// Start the server
const PORT = process.env.PORT  || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});