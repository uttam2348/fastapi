import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login attempt started");
    
    try {
      // Place params creation inside the handler to capture latest state
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
      console.log("Sending login request to:", `${API_URL}/auth/token`);

      // POST to FastAPI OAuth2 token endpoint (expects form data!)
      const res = await fetch(`${API_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Login failed");
      }
      
      const data = await res.json();
      console.log("Login response received:", data);

      // Save JWT token in localStorage
      localStorage.setItem("token", data.access_token);
      console.log("Token saved to localStorage:", data.access_token);

      // Redirect to dashboard
      console.log("Attempting to navigate to /dashboard");
      navigate("/dashboard");
      console.log("Navigation called");
    } catch (err) {
      console.error("Login error:", err.message || err);
      alert(`Login failed: ${err.message || "Please check credentials."}`);
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
