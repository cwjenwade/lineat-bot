const fs = require('fs');
const { Readable } = require('stream');

const cloudinary = require('cloudinary').v2;

let configured = false;

function parseCloudinaryUrl(value = '') {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'cloudinary:') return null;
    const cloudName = `${parsed.hostname || ''}`.trim();
    const apiKey = decodeURIComponent(parsed.username || '');
    const apiSecret = decodeURIComponent(parsed.password || '');
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch (_error) {
    return null;
  }
}

function getCloudinaryCredentials() {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL || '');
  if (fromUrl) {
    return fromUrl;
  }

  const cloudName = `${process.env.CLOUDINARY_CLOUD_NAME || ''}`.trim();
  const apiKey = `${process.env.CLOUDINARY_API_KEY || ''}`.trim();
  const apiSecret = `${process.env.CLOUDINARY_API_SECRET || ''}`.trim();

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }

  return null;
}

function hasCloudinaryConfig() {
  return Boolean(getCloudinaryCredentials());
}

function ensureCloudinaryConfigured() {
  const credentials = getCloudinaryCredentials();
  if (!credentials) {
    throw new Error('Missing Cloudinary env');
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true
    });
    configured = true;
  }

  return cloudinary;
}

function uploadStream(cloudinaryClient, options, buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryClient.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

async function uploadStoryNodeImage({ filePath = '', buffer = null, dataUri = '', storyId = '', nodeId = '' } = {}) {
  const cloudinaryClient = ensureCloudinaryConfigured();
  const folder = `lineat-picturebooks/${String(storyId || '').trim()}/${String(nodeId || '').trim()}`;
  const publicId = `${folder}/main`;
  const uploadOptions = {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    use_filename: false,
    unique_filename: false
  };

  let result;
  if (filePath) {
    const inputPath = `${filePath}`.trim();
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Image file not found: ${inputPath}`);
    }
    result = await cloudinaryClient.uploader.upload(inputPath, uploadOptions);
  } else if (buffer) {
    result = await uploadStream(cloudinaryClient, uploadOptions, buffer);
  } else if (dataUri) {
    result = await cloudinaryClient.uploader.upload(dataUri, uploadOptions);
  } else {
    throw new Error('Missing image input');
  }

  return {
    secureUrl: result.secure_url || result.url || '',
    publicId: result.public_id || publicId,
    width: result.width || null,
    height: result.height || null,
    format: result.format || '',
    bytes: result.bytes || 0
  };
}

module.exports = {
  hasCloudinaryConfig,
  uploadStoryNodeImage
};