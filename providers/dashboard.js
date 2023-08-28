const { captureLog } = require("../utils/common-functions");
const { invokeAPI } = require("./api-helper");

/**
 * Function to fetch stats
 * @param {*} from
 * @param {*} to
 * @returns Stats
 */
async function fetchStats(from, to) {
  // Default to the last 7 days if dates are not provided
  if (!from || !to) {
    from = new Date();
    from.setDate(from.getDate() - 7);
    to = new Date();
  }

  from = from.toISOString().split("T")[0];
  to = to.toISOString().split("T")[0];

  try {
    const response = await invokeAPI({
      method: "GET",
      url: `v1/store/stats?from=${from}&to=${to}`,
    });

    console.log(response);
    return response; // Return the entire data object
  } catch (error) {
    captureLog({ method: "error", error }); // Send the error to Sentry if needed
    return {};
  }
}

module.exports = {
  fetchStats,
};
