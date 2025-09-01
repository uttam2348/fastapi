// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("ProtectedRoute useEffect: Token found:", !!token);
    console.log("ProtectedRoute useEffect: Token value:", token);
    
    if (!token) {
      console.log("ProtectedRoute useEffect: No token, redirecting to login");
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
    } else {
      console.log("ProtectedRoute useEffect: Token valid, setting authenticated");
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  console.log("ProtectedRoute: Rendering protected content");
  return children;
}

export default function App() {
  console.log("App component mounted");
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}



