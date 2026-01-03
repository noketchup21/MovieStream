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
import Recommend from "./recommend/recommend.jsx";
import Review from "./components/review/Review.jsx";
import axiosClient from "./api/axiosConfig";
import useAuth from "./hook/useAuth";
import StreamMovie from "./components/stream/StreamMovie.jsx";

function App() {
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const updateMovieReview = (imdb_id) => {
    navigate(`/review/${imdb_id}`);
  };
  const handleLogout = async () => {
    try {
      const response = await axiosClient.post("/logout", {
        user_id: auth.user_id,
      });
      console.log(response.data);
      setAuth(null);
      // localStorage.removeItem('user');
      console.log("User logged out");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <>
      <Header handleLogout={handleLogout} />
      <Routes path="/" element={<Layout />}>
        <Route path="*" element={<Navigate to="/" />} />
        <Route
          path="/"
          element={<Home updateMovieReview={updateMovieReview} />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/verify-email" element={<EmailVerification />} />

        <Route element={<RequireAuth />}>
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/review/:imdb_id" element={<Review />} />
          <Route path="/stream/:imdb_id" element={<StreamMovie />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
