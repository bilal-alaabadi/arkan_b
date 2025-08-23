const express = require("express");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const router = express.Router();

// post a product
const { uploadImages } = require("../utils/uploadImage");

router.post("/uploadImages", async (req, res) => {
    try {
        const { images } = req.body; // images هي مصفوفة من base64
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

// نقطة النهاية لإنشاء منتج
router.post("/create-product", async (req, res) => {
  try {
    const { name, category, size, description,  oldPrice, price, image, author } = req.body;

    // التحقق من الحقول المطلوبة الأساسية
    if (!name || !category || !description || !price || !image || !author) {
      return res.status(400).send({ message: "جميع الحقول المطلوبة يجب إرسالها" });
    }

    // إذا كانت الفئة حناء بودر، نتحقق من وجود الحجم
    if (category === 'حناء بودر' && !size) {
      return res.status(400).send({ message: "يجب تحديد حجم الحناء" });
    }

    // إنشاء كائن المنتج
    const productData = {
      name: category === 'حناء بودر' ? `${name} - ${size}` : name,
      category,
      description,
      price,
      oldPrice,
      image,
      author,
    };

    // إضافة الحجم فقط لمنتجات الحناء
    if (category === 'حناء بودر') {
      productData.size = size;
    }

    const newProduct = new Products(productData);
    const savedProduct = await newProduct.save();

    res.status(201).send(savedProduct);
  } catch (error) {
    console.error("Error creating new product", error);
    res.status(500).send({ message: "Failed to create new product" });
  }
});


// get all products
router.get("/", async (req, res) => {
  try {
    const {
      category,
      size,
      color,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
      
      // إذا كانت الفئة حناء بودر وكان هناك حجم محدد
      if (category === 'حناء بودر' && size) {
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

//   get single Product
// get single Product (يدعم كلا المسارين)
router.get(["/:id", "/product/:id"], async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Products.findById(productId).populate(
      "author",
      "email username"
    );
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    const reviews = await Reviews.find({ productId }).populate(
      "userId",
      "username email"
    );
    res.status(200).send({ product, reviews });
  } catch (error) {
    console.error("Error fetching the product", error);
    res.status(500).send({ message: "Failed to fetch the product" });
  }
});

// update a product
const multer = require('multer');
const upload = multer();

router.patch("/update-product/:id", 
    verifyToken, 
    verifyAdmin, 
    upload.single('image'),
    async (req, res) => {
        try {
            const productId = req.params.id;
            
            let updateData = {
                name: req.body.name,
                category: req.body.category,
                price: req.body.price,
                oldPrice: req.body.oldPrice || null,
                description: req.body.description,
                size: req.body.size || null,
                author: req.body.author
            };

            // التحقق من الحقول المطلوبة للتحديث
            if (!updateData.name || !updateData.category || !updateData.price || !updateData.description) {
                return res.status(400).send({ message: "جميع الحقول المطلوبة يجب إرسالها" });
            }

            // إذا كانت الفئة حناء بودر، نتحقق من وجود الحجم
            if (updateData.category === 'حناء بودر' && !updateData.size) {
                return res.status(400).send({ message: "يجب تحديد حجم الحناء" });
            }

            if (req.file) {
                updateData.image = req.file.path;
            }

            const updatedProduct = await Products.findByIdAndUpdate(
                productId,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!updatedProduct) {
                return res.status(404).send({ message: "المنتج غير موجود" });
            }

            res.status(200).send({
                message: "تم تحديث المنتج بنجاح",
                product: updatedProduct,
            });
        } catch (error) {
            console.error("خطأ في تحديث المنتج", error);
            res.status(500).send({ 
                message: "فشل تحديث المنتج",
                error: error.message
            });
        }
    }
);

// delete a product

router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const deletedProduct = await Products.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    // delete reviews related to the product
    await Reviews.deleteMany({ productId: productId });

    res.status(200).send({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting the product", error);
    res.status(500).send({ message: "Failed to delete the product" });
  }
});

// get related products
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
      _id: { $ne: id }, // Exclude the current product
      $or: [
        { name: { $regex: titleRegex } }, // Match similar names
        { category: product.category }, // Match the same category
      ],
    });

    res.status(200).send(relatedProducts);

  } catch (error) {
    console.error("Error fetching the related products", error);
    res.status(500).send({ message: "Failed to fetch related products" });
  }
});

module.exports = router;
