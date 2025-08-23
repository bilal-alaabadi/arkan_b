const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    size: { type: String }, // إضافة حقل الحجم
    description: { type: String, required: true },
    price: { type: Number, required: true }, // السعر العادي لجميع المنتجات
    image: { type: [String], required: true },
    oldPrice: { type: Number },
    rating: { type: Number, default: 0 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

const Products = mongoose.model("Product", ProductSchema);

module.exports = Products;