import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000", // adjust if your FastAPI runs elsewhere
});

// Attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
