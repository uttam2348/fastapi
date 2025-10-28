import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      // POST to FastAPI OAuth2 token endpoint (expects x-www-form-urlencoded)
      const response = await API.post("/auth/token", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const data = response.data;

      // Save JWT token in localStorage
      localStorage.setItem("token", data.access_token);

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      // Robust error handling for common axios scenarios
      let errorMessage = "Login failed. Please try again.";

      if (err.code === "ECONNABORTED") {
        errorMessage =
          "Connection timeout. Please check your internet connection and try again.";
      } else if (err.code === "ERR_NETWORK") {
        errorMessage =
          "Network error. Please make sure the server is running and try again.";
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
