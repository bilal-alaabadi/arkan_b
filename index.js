// server.js (أو index.js الخاص بالسيرفر)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const path = require("path");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const port = 5009;

// Body parsers
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cookieParser());

// ====== CORS (مهم) ======
const allowedOrigins = [
  "https://www.arkanalgwda.com",
  "https://arkanalgwda.com",
  "http://localhost:5173",
];

// ملاحظة: لا نحدد allowedHeaders هنا؛ المكتبة ستعكس المطلوب تلقائياً
const corsOptions = {
  origin: function (origin, callback) {
    // السماح بالطلبات بدون Origin (Postman/Server-to-Server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// فعليًا فعّل CORS
app.use(cors(corsOptions));

// رد على كل الـ preflight قبل الراوترات
app.options("*", cors(corsOptions));

// ====== بقية الإعداد ======

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
