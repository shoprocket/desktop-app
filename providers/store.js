const { captureLog } = require("../utils/common-functions");
const { invokeAPI } = require("./api-helper");

// Async function to fetch store details
async function fetchStoreDetails() {
  try {
    const response = await invokeAPI({
      method: "GET",
      url: "v1/store/details",
    });

    return response.data;
  } catch (error) {
    // Handle Axios-specific error details
    if (error.response) {
      let err = new Error(
        `${error.response.status} - ${error.response.statusText}`
      );
      captureLog({ method: "error", error: err }); // Send the error to Sentry
    } else {
      captureLog({ method: "error", error }); // Send the error to Sentry
    }
  }
}

// Define the function to fetch stats
async function fetchSubscription() {
  try {
    const response = await invokeAPI({ method: "GET", url: "v1/subscription" });

    return response.data; // Return the entire data object
  } catch (error) {
    captureLog({ method: "error", error }); // Send the error to Sentry if needed
  }
}

module.exports = {
  fetchStoreDetails,
  fetchSubscription,
};
