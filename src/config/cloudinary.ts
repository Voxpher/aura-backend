import { v2 as cloudinary } from 'cloudinary';

/**
 * Configures the Cloudinary SDK using environment variables.
 * Must be called before any Cloudinary upload operations.
 */
export function configureCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '[Cloudinary] Environment variables not fully set — avatar uploads will be unavailable until configured.'
    );
    return;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log('Cloudinary configured');
}

export { cloudinary };
