import { useState } from "react";
import "./App.css";
import Home from "./components/home/Home.jsx";
import Header from "./components/header/Header.jsx";
import Login from "./components/login/Login.jsx";
import Register from "./components/register/Register.jsx";
import EmailVerification from "./components/emailVerification/EmailVerification.jsx";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

function App() {
  return (
    <>
      <Header />
      <Routes path="/" element={<Layout />}>
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/verify-email" element={<EmailVerification />} />

        <Route element={<RequireAuth />}>
          <Route
            path="/recommend"
            element={<h2>Recommendations Page - Coming Soon!</h2>}
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;
