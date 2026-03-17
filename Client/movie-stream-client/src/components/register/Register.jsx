import { useState, useEffect } from "react";
// import "./Register.css";
import Container from "react-bootstrap/esm/Container";
import Button from "react-bootstrap/esm/Button";
import Form from "react-bootstrap/esm/Form";
import axiosClient from "../../api/axiosConfig";
import { useNavigate, Link } from "react-router-dom";
import Loading from "../loading/Loading";
import logo from "../../assets/logo.png";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [genres, setGenres] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const toggleGenre = (genre) => {
    setFavoriteGenres((prev) => {
      const isSelected = prev.some((g) => g.genre_id === genre.genre_id);
      if (isSelected) {
        return prev.filter((g) => g.genre_id !== genre.genre_id);
      } else {
        return [
          ...prev,
          { genre_id: genre.genre_id, genre_name: genre.genre_name },
        ];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const defaultRole = "USER";

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    try {
      const payload = {
        username: username,
        email: email,
        password: password,
        role: defaultRole,
        favorite_genres: favoriteGenres,
      };
      const response = await axiosClient.post("/register", payload);
      if (response.data.error) {
        setError(response.data.error);
        setLoading(false);
        return;
      }
      // Registration successful, navigate to confirmation page
      navigate("/auth/verify-email", { state: { email: email } });
    } catch (err) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await axiosClient.get("/genres");
        setGenres(response.data);
      } catch (err) {
        console.error("Error fetching genres:", err);
      }
    };
    fetchGenres();
  }, []);

  return (
    <>
      {loading && <Loading />}
      <Container className="login-container d-flex align-items-center justify-content-center min-vh-100">
        <div
          className="login-card glass-panel auth-card"
          style={{ maxWidth: 400, width: "100%" }}
        >
          <div className="text-center mb-4">
            <img
              src={logo}
              alt="Logo"
              width={60}
              height={60}
              className="mb-2"
            />
            <h2 className="fw-bold">Register</h2>
            <p className="text-muted">
              Create your personal MovieStream account.
            </p>
            {error && <div className="alert alert-danger py-2">{error}</div>}
          </div>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                isInvalid={!!confirmPassword && password !== confirmPassword}
              />
              <Form.Control.Feedback type="invalid">
                Passwords do not match.
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Favorite Genres</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {genres.map((genre) => {
                  const isSelected = favoriteGenres.some(
                    (g) => g.genre_id === genre.genre_id,
                  );
                  return (
                    <span
                      key={genre.genre_id}
                      onClick={() => toggleGenre(genre)}
                      className={
                        isSelected ? "genre-chip active" : "genre-chip"
                      }
                    >
                      {genre.genre_name}
                    </span>
                  );
                })}
              </div>
              <Form.Text className="text-muted">
                Click to select your favorite genres.
              </Form.Text>
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100 mb-2"
              disabled={loading}
              style={{ fontWeight: 600, letterSpacing: 1 }}
            >
              Register
            </Button>
          </Form>
        </div>
      </Container>
    </>
  );
};
export default Register;
