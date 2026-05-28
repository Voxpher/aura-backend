"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = exports.configureCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
/**
 * Configures the Cloudinary SDK using environment variables.
 * Must be called before any Cloudinary upload operations.
 */
function configureCloudinary() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        console.warn('[Cloudinary] Environment variables not fully set — avatar uploads will be unavailable until configured.');
        return;
    }
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });
    console.log('Cloudinary configured');
}
exports.configureCloudinary = configureCloudinary;
//# sourceMappingURL=cloudinary.js.map