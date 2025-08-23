const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const opts = {
    overwrite: true,
    invalidate: true,
    resource_type: "auto",
    folder: "products", // اختياري: مجلد لحفظ الصور
};

module.exports = (image) => {
    return new Promise((resolve, reject) => {
        if (!image) {
            return reject({ message: "No image provided" });
        }

        cloudinary.uploader.upload(image, opts, (error, result) => {
            if (result && result.secure_url) {
                return resolve(result.secure_url);
            }
            console.error("Cloudinary error:", error.message);
            return reject({ message: error.message });
        });
    });
};