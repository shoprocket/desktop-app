const { GLOBAL_VARIABLE } = require("../utils/constants");
const { invokeAPI } = require("./api-helper");

/**
 * FUNCTION TO FETCH ORDERS
 * @returns Orders
 */
async function fetchOrders() {
  // Check if API key is set
  if (!GLOBAL_VARIABLE.API_KEY) {
    console.error(
      "API key is not set. Please set the API key before fetching orders."
    );
    return [];
  }

  try {
    const response = await invokeAPI({
      method: "GET",
      url: "v1/orders?limit=100&page=0",
    });

    return response || []; // Axios automatically parses the JSON response
  } catch (error) {
    return [];
  }
}

module.exports = { fetchOrders };
