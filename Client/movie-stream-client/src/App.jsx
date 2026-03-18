import "./App.css";
import Home from "./components/home/Home.jsx";
import Header from "./components/header/Header.jsx";
import Login from "./components/login/Login.jsx";
import Register from "./components/register/Register.jsx";
import ForgotPassword from "./components/forgotPassword/ForgotPassword.jsx";
import EmailVerification from "./components/emailVerification/EmailVerification.jsx";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import Recommend from "./recommend/Recommend.jsx";
import Review from "./components/review/Review.jsx";
import AddMovie from "./components/admin/AddMovie.jsx";
import EditMovie from "./components/admin/EditMovie.jsx";
import axiosClient from "./api/axiosConfig";
import useAuth from "./hook/useAuth";
import StreamMovie from "./components/stream/StreamMovie.jsx";
import Browse from "./components/home/Browse.jsx";

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
    <div className="app-shell">
      <Header handleLogout={handleLogout} />
      <Routes path="/" element={<Layout />}>
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/" element={<Home />} />
        <Route
          path="/browse"
          element={<Browse updateMovieReview={updateMovieReview} />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify-email" element={<EmailVerification />} />

        <Route element={<RequireAuth />}>
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/review/:imdb_id" element={<Review />} />
          <Route path="/stream/:imdb_id" element={<StreamMovie />} />
          <Route path="/admin/add-movie" element={<AddMovie />} />
          <Route path="/admin/edit-movies" element={<EditMovie />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
