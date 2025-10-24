// src/App.js
<<<<<<< HEAD
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
=======
import React, { useEffect, useState, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from "react-router-dom";

// Lazy load components for code splitting
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
>>>>>>> master

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
<<<<<<< HEAD
=======
  const [error, setError] = useState(null);
>>>>>>> master
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
<<<<<<< HEAD
    console.log("ProtectedRoute useEffect: Token found:", !!token);
    console.log("ProtectedRoute useEffect: Token value:", token);
=======
    console.log("ProtectedRoute useEffect: Token found:", !!token, "Token:", token);
>>>>>>> master
    
    if (!token) {
      console.log("ProtectedRoute useEffect: No token, redirecting to login");
      setIsAuthenticated(false);
<<<<<<< HEAD
      navigate("/login", { replace: true });
    } else {
      console.log("ProtectedRoute useEffect: Token valid, setting authenticated");
      setIsAuthenticated(true);
    }
    setIsLoading(false);
=======
      setIsLoading(false);
      navigate("/login", { replace: true });
    } else {
      // Verify token validity with backend
      const verifyToken = async () => {
        const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8001";
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            console.log("ProtectedRoute useEffect: Token valid, setting authenticated");
            setIsAuthenticated(true);
          } else {
            console.log("ProtectedRoute useEffect: Invalid token, redirecting to login");
            localStorage.removeItem("token"); // Clear invalid token
            setIsAuthenticated(false);
            navigate("/login", { replace: true });
          }
        } catch (error) {
          console.error("Token verification error:", error);
          setError("Unable to verify token. Please check if the backend server is running and try logging in again.");
          setIsAuthenticated(false);
          // Don't navigate immediately, show error first
          setTimeout(() => navigate("/login", { replace: true }), 3000);
        } finally {
          setIsLoading(false);
        }
      };
      
      verifyToken();
    }
>>>>>>> master
  }, [navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

<<<<<<< HEAD
=======
  if (error) {
    return <div style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>{error}</div>;
  }

>>>>>>> master
  if (!isAuthenticated) {
    return null;
  }

  console.log("ProtectedRoute: Rendering protected content");
  return children;
}

export default function App() {
  console.log("App component mounted");
<<<<<<< HEAD
  
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



=======

  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
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
      </Suspense>
    </Router>
  );
}
>>>>>>> master
