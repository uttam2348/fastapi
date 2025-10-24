        import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:8001",
  headers: {
    "Content-Type": "application/json"
  },
  timeout: 15000, // Increased timeout to 15 seconds
  retry: 3, // Retry failed requests 3 times
  retryDelay: 1000 // Wait 1 second between retries
});

// Add retry logic for failed requests
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // If request failed and we haven't exceeded retry limit
    if (config && config.retry && config.retry > 0 && error.code === 'ECONNABORTED') {
      config.retry -= 1;
      console.log(`Retrying request... ${config.retry} attempts left`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
      
      return API(config);
    }
    
    return Promise.reject(error);
  }
);

// Attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
