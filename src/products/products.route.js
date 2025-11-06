// routes/products.js
const express = require("express");
const router = express.Router();

const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// رفع صور (Base64 → URLs)
const { uploadImages } = require("../utils/uploadImage");
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    // لو ما في استعلام -> رجع كل المنتجات (مثلاً حتى 100)
    if (!q || !String(q).trim()) {
      const allProducts = await Products.find({})
        .sort({ createdAt: -1 })
        .limit(100);
      return res.status(200).json(allProducts);
    }

    // تنظيف النص من المسافات الزائدة
    const cleanQuery = String(q).trim().replace(/\s+/g, ' ');

    // تقسيم النص إلى كلمات منفصلة
    const words = cleanQuery.split(' ').filter(Boolean);

    // بناء تعبير Regex يدعم وجود أي من الكلمات بأي ترتيب
    const regexPattern = words.join('.*'); // مثلاً "عسل زهر" → "عسل.*زهر"
    const regex = new RegExp(regexPattern, 'i'); // 'i' لتجاهل حالة الأحرف

    // البحث في الاسم أو الوصف باستخدام الـ regex
    const products = await Products.find({
      $or: [
        { name: { $regex: regex } },
        { description: { $regex: regex } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(products);
  } catch (error) {
    console.error("فشل البحث:", error);
    res.status(500).json({ message: "فشل البحث" });
  }
});

// دوال مساعدة
function withSizeInName(name, size) {
  const baseName = String(name || "").replace(/\s*-\s*.+$/, "").trim();
  if (size && String(size).trim()) return `${baseName} - ${size}`;
  return baseName;
}
function normalizeToArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {
      if (val.includes(",")) return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return val.trim() ? [val.trim()] : [];
  }
  return [];
}

// ======================= رفع الصور =======================
router.post("/uploadImages", async (req, res) => {
  try {
    const { images } = req.body; // images مصفوفة base64
    if (!images || !Array.isArray(images)) {
      return res.status(400).send({ message: "يجب إرسال مصفوفة من الصور" });
    }
    const uploadedUrls = await uploadImages(images);
    res.status(200).send(uploadedUrls);
  } catch (error) {
    console.error("Error uploading images:", error);
    res.status(500).send({ message: "حدث خطأ أثناء تحميل الصور" });
  }
});

// ======================= إنشاء منتج =======================
// backend/routes/products.js
// backend/routes/products.js (إنشاء منتج)
router.post("/create-product", async (req, res) => {
  try {
    const { name, category, size, description, oldPrice, price, image, author, stock } = req.body;

    // الحقول المطلوبة
    if (!name || !category || !description || !price || !image || !author) {
      return res.status(400).send({ message: "جميع الحقول المطلوبة يجب إرسالها" });
    }

    // التحقق من الكمية (إن لم تُرسل نعتبرها 0)
    const parsedStock = stock !== undefined && stock !== null && String(stock).trim() !== ''
      ? Number(stock)
      : 0;
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).send({ message: "الكمية يجب أن تكون رقمًا صالحًا أكبر أو يساوي 0" });
    }

    // إضافة الحجم إلى الاسم فقط إذا تم إدخاله
    const finalName = size && String(size).trim() ? withSizeInName(name, size) : name;

    const productData = {
      name: finalName,
      category,
      size: size && String(size).trim() ? size : undefined, // الحجم اختياري
      description,
      price: Number(price),
      oldPrice: oldPrice !== undefined && oldPrice !== null && oldPrice !== '' ? Number(oldPrice) : undefined,
      image,
      author,
      stock: parsedStock, // ✅ تخزين الكمية
    };

    const newProduct = new Products(productData);
    const savedProduct = await newProduct.save();
    res.status(201).send(savedProduct);
  } catch (error) {
    console.error("Error creating new product", error);
    res.status(500).send({ message: "Failed to create new product" });
  }
});

// ======================= جلب المنتجات مع فلاتر =======================
router.get("/", async (req, res) => {
  try {
    const { category, size, color, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
      if (category === "حناء بودر" && size) {
        filter.size = size;
      }
    }

    if (color && color !== "all") {
      filter.color = color;
    }

    if (minPrice && maxPrice) {
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!isNaN(min) && !isNaN(max)) {
        filter.price = { $gte: min, $lte: max };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalProducts = await Products.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    const products = await Products.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "email")
      .sort({ createdAt: -1 });

    res.status(200).send({ products, totalPages, totalProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});

// ======================= منتج واحد + مراجعاته =======================
router.get(["/:id", "/product/:id"], async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Products.findById(productId).populate("author", "email username");
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    const reviews = await Reviews.find({ productId }).populate("userId", "username email");
    res.status(200).send({ product, reviews });
  } catch (error) {
    console.error("Error fetching the product", error);
    res.status(500).send({ message: "Failed to fetch the product" });
  }
});

// ======================= تحديث منتج =======================
const multer = require("multer");
const upload = multer().none();

// backend/routes/products.js
// تأكد أن هذا الملف يستورد ما يحتاجه مثل: express, verifyToken, verifyAdmin, upload, Products, withSizeInName ...إلخ

// دالة لإزالة أي حجم سابق من نهاية الاسم (سواء كان " - الحجم" أو داخل أقواس في نهاية الاسم)
// backend/routes/products.js  (تحديث المنتج مع دعم حذف الحجم من الاسم + الكمية)

// دالة لإزالة أي حجم سابق من نهاية الاسم (مثل: " - 1 كجم" أو "(1 كجم)")
function stripSizeFromName(name = '') {
  return String(name)
    .replace(/\s*[-–—]\s*[^()\[\]{}]*$/, '')
    .replace(/\s*[\(\[\{][^()\[\]{}]*[\)\]\}]$/, '')
    .trim();
}

router.patch(
  "/update-product/:id",
  verifyToken,
  verifyAdmin,
  upload,
  async (req, res) => {
    try {
      const productId = req.params.id;
      const { name, category, price, oldPrice, description, size, author, existingImages, stock } = req.body;

      // الحقول المطلوبة (الحجم ليس مطلوبًا)
      if (!name || !category || !price || !description) {
        return res.status(400).send({ message: "جميع الحقول المطلوبة يجب إرسالها" });
      }

      // الكمية (إن لم تُرسل نعتبرها 0) مع التحقق
      const parsedStock =
        stock !== undefined && stock !== null && String(stock).trim() !== ''
          ? Number(stock)
          : 0;

      if (!Number.isFinite(parsedStock) || parsedStock < 0) {
        return res.status(400).send({ message: "الكمية يجب أن تكون رقمًا صالحًا أكبر أو يساوي 0" });
      }

      // معالجة الصور (جديدة أو قديمة)
      const incomingImages = normalizeToArray(req.body.image);
      const oldImgs = normalizeToArray(existingImages);
      const finalImages = incomingImages.length > 0 ? incomingImages : oldImgs;

      if (!finalImages || finalImages.length === 0) {
        return res.status(400).send({ message: "يجب إرسال صورة واحدة على الأقل للمنتج" });
      }

      // إذا تم حذف الحجم (فارغ)، نحذف الحجم من الاسم أيضًا
      const hasSize = size !== undefined && size !== null && String(size).trim() !== '';

      // نأخذ الاسم الأساسي ثم نُضيف الحجم فقط إن وُجد
      const baseName = stripSizeFromName(name);
      const finalName = hasSize ? withSizeInName(baseName, String(size).trim()) : baseName;

      const updateData = {
        name: finalName,
        category,
        description,
        size: hasSize ? String(size).trim() : null, // الحجم يصبح null عند الحذف
        author,
        price: Number(price),
        oldPrice:
          oldPrice !== undefined && oldPrice !== null && String(oldPrice).trim() !== ''
            ? Number(oldPrice)
            : null,
        image: finalImages,
        stock: parsedStock, // ✅ تحديث الكمية
      };

      const updatedProduct = await Products.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        return res.status(404).send({ message: "المنتج غير موجود" });
      }

      res.status(200).send({ message: "تم تحديث المنتج بنجاح", product: updatedProduct });
    } catch (error) {
      console.error("خطأ في تحديث المنتج", error);
      res.status(500).send({ message: "فشل تحديث المنتج", error: error.message });
    }
  }
);



// ======================= حذف منتج =======================
router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const deletedProduct = await Products.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    await Reviews.deleteMany({ productId });

    res.status(200).send({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting the product", error);
    res.status(500).send({ message: "Failed to delete the product" });
  }
});

// ======================= منتجات ذات صلة =======================
router.get("/related/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ message: "Product ID is required" });
    }

    const product = await Products.findById(id);
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const titleRegex = new RegExp(
      product.name
        .split(" ")
        .filter((word) => word.length > 1)
        .join("|"),
      "i"
    );

    const relatedProducts = await Products.find({
      _id: { $ne: id },
      $or: [{ name: { $regex: titleRegex } }, { category: product.category }],
    });

    res.status(200).send(relatedProducts);
  } catch (error) {
    console.error("Error fetching the related products", error);
    res.status(500).send({ message: "Failed to fetch related products" });
  }
});

module.exports = router;
