import React, { useState } from "react";
<<<<<<< HEAD
import axios from "axios";
import { useNavigate } from "react-router-dom";
=======
import { useNavigate } from "react-router-dom";
import API from "../api";
>>>>>>> master

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login attempt started");
<<<<<<< HEAD
    
    try {
      // Place params creation inside the handler to capture latest state
=======

    try {
      // Create URLSearchParams for OAuth2 token endpoint
>>>>>>> master
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

<<<<<<< HEAD
      console.log("Sending login request to:", "http://127.0.0.1:8000/auth/token");

      // POST to FastAPI OAuth2 token endpoint (expects form data!)
      const res = await axios.post(
        "http://127.0.0.1:8000/auth/token",
        params,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      console.log("Login response received:", res.data);

      // Save JWT token in localStorage
      localStorage.setItem("token", res.data.access_token);
      console.log("Token saved to localStorage");
=======
      console.log("Sending login request to: /auth/token");

      // POST to FastAPI OAuth2 token endpoint (expects x-www-form-urlencoded)
      const response = await API.post("/auth/token", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        retry: 3, // Enable retry for this request
        retryDelay: 1000
      });

      const data = response.data;
      console.log("Login response received:", data);

      // Save JWT token in localStorage
      localStorage.setItem("token", data.access_token);
      console.log("Token saved to localStorage:", data.access_token);
>>>>>>> master

      // Redirect to dashboard
      console.log("Attempting to navigate to /dashboard");
      navigate("/dashboard");
      console.log("Navigation called");
    } catch (err) {
<<<<<<< HEAD
      console.error("Login error:", err.response?.data || err);
      alert("Login failed. Please check credentials.");
=======
      console.error("Login error:", err);
      
      // Better error handling
      let errorMessage = "Login failed. Please try again.";
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = "Connection timeout. Please check your internet connection and try again.";
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = "Network error. Please make sure the server is running and try again.";
      } else if (err.response?.status === 401) {
        errorMessage = "Invalid username or password. Please check your credentials.";
      } else if (err.response?.status === 422) {
        errorMessage = "Invalid input. Please check your username and password.";
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(`Login failed: ${errorMessage}`);
>>>>>>> master
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-100 to-purple-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Login to Your Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition"
          >
            Login
          </button>
        </form>
        <p className="text-sm text-gray-600 text-center mt-4">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-500 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
