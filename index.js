const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const path = require("path");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const port = 5009;

// Remove bodyParser (redundant with express.json())
app.use(express.json({ limit: "25mb" }));  // Handles JSON payloads
app.use(express.urlencoded({ extended: true, limit: "25mb" }));  // For URL-encoded data
app.use(cookieParser());

// Enhanced CORS configuration
const allowedOrigins = [
  "https://www.arkanalgwda.com",
  "https://arkanalgwda.com",
  "http://localhost:5173",
];

// 👇 نفس الإعدادات مع إضافة PATCH
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // ← PATCH مضافة هنا
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// OPTIONS handler (for preflight) — استخدم نفس الخيارات
app.options('*', cors(corsOptions));  // Let the cors middleware handle it

// رفع الصور
const uploadImage = require("./src/utils/uploadImage");

// جميع الروابط
const authRoutes = require("./src/users/user.route");
const productRoutes = require("./src/products/products.route");
const reviewRoutes = require("./src/reviews/reviews.router");
const orderRoutes = require("./src/orders/orders.route");
const statsRoutes = require("./src/stats/stats.rout");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stats", statsRoutes);

// الاتصال بقاعدة البيانات
main()
    .then(() => console.log("MongoDB is successfully connected."))
    .catch((err) => console.log(err));

async function main() {
    await mongoose.connect(process.env.DB_URL);

    app.get("/", (req, res) => {
        res.send("يعمل الان");
    });
}

// رفع صورة واحدة
app.post("/uploadImage", (req, res) => {
    uploadImage(req.body.image)
        .then((url) => res.send(url))
        .catch((err) => res.status(500).send(err));
});

// رفع عدة صور
app.post("/uploadImages", async (req, res) => {
    try {
        const { images } = req.body;
        if (!images || !Array.isArray(images)) {
            return res.status(400).send("Invalid request: images array is required.");
        }

        const uploadPromises = images.map((image) => uploadImage(image));
        const urls = await Promise.all(uploadPromises);

        res.send(urls);
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).send("Internal Server Error");
    }
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
