const { MESSAGES } = require("./constants");

const { init, captureMessage, captureException } = require("@sentry/electron");

/**
 * FUNCTION TO INITIALIZE SENTRY
 */
function initSentry() {
  init({
    dsn: "https://da46f9ed305c995d63364f3cc626ae3f@o925826.ingest.sentry.io/4505726470979584",
  });
  captureLog({ method: "message", message: MESSAGES.APP_READY });
}

/**
 * FUNCTION TO CAPTURE MESSAGE/ERROR
 * @param {*} { method, message, error }
 */
function captureLog({ method, message = "", error = {} }) {
  if (method === "message") captureMessage(message);
  if (method === "error") captureException(error);
}

/**
 * FUNCTION TO CALCULATE TIME AGO
 * @param {*} dateString
 * @returns String
 */
function timeAgo(dateString) {
  // Add 'Z' to the dateString to indicate UTC time
  const date = new Date(dateString + "Z");
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "a few seconds ago";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

/**
 * Function to create an MD5 hash of a string
 * @param {*} str
 * @returns
 */
function md5(str) {
  // Use a library like CryptoJS to generate the MD5 hash
  return CryptoJS.MD5(str.toLowerCase().trim()).toString();
}

module.exports = {
  initSentry,
  captureLog,
  timeAgo,
  md5,
};
