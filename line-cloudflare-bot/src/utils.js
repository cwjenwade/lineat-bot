function normalizeBaseUrl(baseUrl) {
  const raw = `${baseUrl || ''}`.trim();
  if (!raw) {
    throw new Error('Missing required env: R2_PUBLIC_BASE_URL');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid R2_PUBLIC_BASE_URL: ${raw}`);
  }

  // 移除尾端多餘斜線
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/+$/, '');
}

function normalizeFileName(fileName) {
  const value = `${fileName || ''}`.trim();
  if (!value) {
    throw new Error('Image node missing required fileName');
  }
  return value.replace(/^\/+/, '');
}

export function buildR2PublicImageUrl(env, fileName) {
  const baseUrl = normalizeBaseUrl(env?.R2_PUBLIC_BASE_URL);
  const safeFileName = normalizeFileName(fileName);
  return `${baseUrl}/${safeFileName}`.replace(/([^:]\/)\/+/g, '$1');
}
