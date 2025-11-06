// backend/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    size: { type: String }, // اختياري
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: [String], required: true },
    oldPrice: { type: Number },
    stock: { type: Number, required: true, min: 0, default: 0 }, // ✅ كمية المنتج
    rating: { type: Number, default: 0 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
