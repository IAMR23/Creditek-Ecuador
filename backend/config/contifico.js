const axios = require("axios");
const http = require("http");
const https = require("https");


const API_CONTIFICO = process.env.API_CONTIFICO;
const API_KEY = process.env.API_KEY;

const contificoAPI = axios.create({
  baseURL: API_CONTIFICO,
  headers: {
   Authorization: API_KEY,
    "Content-Type": "application/json",
  },
   timeout: 5000, 
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

module.exports = { contificoAPI };