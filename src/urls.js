export function listingUrl(listing) {
  return `https://ganknow.com/services/${encodeURIComponent(listing.slug)}`;
}
