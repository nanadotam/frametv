/** Public download + help links, in one place so the site and app agree. */
export const GITHUB_REPO = 'nanadotam/frametv';

/**
 * Direct download of the newest Mac app. GitHub redirects
 * `/releases/latest/download/<asset>` straight to the file, so the browser
 * downloads without ever showing the GitHub page.
 */
export const MAC_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Mantel.dmg`;
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
