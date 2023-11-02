export function slugToName(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getSlug(url) {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

export function removeRootUrl(url) {
  const urlObj = new URL(url);
  return urlObj.pathname;
}

export function extractUsageFromContext(data) {
  if (data && data.context && data.context.usage) {
      return data.context.usage;
  }
  return null; // or return an empty string or any default value if you prefer
}
