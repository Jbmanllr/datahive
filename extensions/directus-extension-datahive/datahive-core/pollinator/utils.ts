export function slugToName(slug : string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getSlug(url : string) {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

export function removeRootUrl(url : string) {
  const urlObj = new URL(url);
  return urlObj.pathname;
}

export function extractUsageFromContext(data : any) {
  if (data && data.context && data.context.usage) {
      return data.context.usage;
  }
  return null; // or return an empty string or any default value if you prefer
}
