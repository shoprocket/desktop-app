const { GLOBAL_VARIABLE, MESSAGES } = require("../utils/constants");

const axios = require("axios");
const allowedMethods = ["GET", "POST", "PUT", "DELETE"];
const request = axios.create({
  baseURL: "https://api.shoprocket.io/",
  headers: {},
});

async function invokeAPI({ method, url, headers, data }) {
  return new Promise(async (resolve, reject) => {
    headers = {
      ...headers,
      "x-api-key": GLOBAL_VARIABLE.API_KEY,
    };

    if (!allowedMethods.find((x) => x.toLowerCase() === method.toLowerCase()))
      return reject(MESSAGES.METHOD_NOT_ALLOWED);

    let response;

    try {
      switch (method) {
        case "GET":
          response = await request.get(url, { headers });
          break;

        case "POST":
          response = await request.post(url, data, { headers });
          break;

        case "DELETE":
          response = await request.delete(url, { headers, data });
          break;

        case "PUT":
          response = await request.put(url, data, { headers });
          break;
      }

      console.log(response);

      return resolve(response.data);
    } catch (error) {
      return reject(error);
    }
  });
}

module.exports = {
  invokeAPI,
};
