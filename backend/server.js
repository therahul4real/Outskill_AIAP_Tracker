const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./db_conn');
const leadRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors()); // Prevents CORS errors when Vite requests data
app.use(express.json()); // Allows parsing of JSON request bodies

// API Routes
app.use('/api/leads', leadRoutes);

// Sample API Route
app.get('/api/health', (req, res) => {
  res.json({ status: "up", message: "Backend is connected successfully!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
