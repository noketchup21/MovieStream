import { useState, useEffect } from "react";
import Container from "react-bootstrap/esm/Container";
import Button from "react-bootstrap/esm/Button";
import Form from "react-bootstrap/esm/Form";
import { useNavigate } from "react-router-dom";
import useAxiosPrivate from "../../hook/useAxiosPrivate";
import useAuth from "../../hook/useAuth";
import axiosClient from "../../api/axiosConfig";
import logo from "../../assets/logo.png";

const AddMovie = () => {
  const [title, setTitle] = useState("");
  const [imdbId, setImdbId] = useState("");
  const [posterPath, setPosterPath] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [adminReview, setAdminReview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();
  const { auth } = useAuth();
  const isAdmin =
    String(auth?.role || "")
      .trim()
      .toUpperCase() === "ADMIN";

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await axiosClient.get("/genres");
        setAvailableGenres(response.data);
      } catch (err) {
        console.error("Error fetching genres:", err);
      }
    };
    fetchGenres();
  }, []);

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) => {
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

  // Redirect if not admin
  if (!auth || !isAdmin) {
    return (
      <Container className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <h2>Access Denied</h2>
          <p className="text-muted">
            You must be an admin to access this page.
          </p>
          <Button variant="primary" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </Container>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate required fields
    if (selectedGenres.length === 0) {
      setError("Please select at least one genre.");
      return;
    }

    setLoading(true);

    try {
      // Create movie payload with all fields including a default ranking
      const moviePayload = {
        title: title,
        imdb_id: imdbId,
        poster_path: posterPath,
        youtube_id: youtubeId,
        genre: selectedGenres,
        ranking: {
          ranking_name: "Unranked",
          ranking_value: 999,
        },
      };

      // First, create the movie
      const response = await axiosPrivate.post("/createmovie", moviePayload);

      if (response.data.error) {
        setError(response.data.error);
        setLoading(false);
        return;
      }

      // If admin review is provided, add it (AI will analyze and assign ranking)
      if (adminReview.trim()) {
        try {
          const reviewResponse = await axiosPrivate.patch(
            `/updatereview/${imdbId}`,
            {
              admin_review: adminReview,
            },
          );

          if (reviewResponse.data.error) {
            setSuccess(
              "Movie added successfully, but review failed to save: " +
                reviewResponse.data.error,
            );
          } else {
            setSuccess(
              `Movie added successfully! AI ranked it as: ${reviewResponse.data.ranking_name}`,
            );
          }
        } catch (reviewErr) {
          setSuccess(
            "Movie added successfully, but failed to add review: " +
              (reviewErr.response?.data?.error || "Unknown error"),
          );
        }
      } else {
        setSuccess("Movie added successfully (no review provided)!");
      }

      // Clear form
      setTitle("");
      setImdbId("");
      setPosterPath("");
      setYoutubeId("");
      setSelectedGenres([]);
      setAdminReview("");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          "Failed to add movie.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="glass-panel" style={{ maxWidth: 500, width: "100%" }}>
        <div className="text-center mb-4">
          <img src={logo} alt="Logo" width={60} height={60} className="mb-2" />
          <h2 className="fw-bold">Add Movie</h2>
          <p className="text-muted">Add a new movie to the database.</p>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Movie Title</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter movie title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>IMDb ID</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., tt1234567"
              value={imdbId}
              onChange={(e) => setImdbId(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              Find this on the movie's IMDb page URL.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Poster URL</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://..."
              value={posterPath}
              onChange={(e) => setPosterPath(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>YouTube Trailer ID</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., dQw4w9WgXcQ"
              value={youtubeId}
              onChange={(e) => setYoutubeId(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              The ID from the YouTube URL (youtube.com/watch?v=XXXXX)
            </Form.Text>
          </Form.Group>

          {posterPath && (
            <div className="mb-3 text-center">
              <p className="text-muted small">Poster Preview:</p>
              <img
                src={posterPath}
                alt="Poster preview"
                style={{ maxHeight: 200, objectFit: "contain" }}
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Genres</Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {availableGenres.map((genre) => {
                const isSelected = selectedGenres.some(
                  (g) => g.genre_id === genre.genre_id,
                );
                return (
                  <span
                    key={genre.genre_id}
                    onClick={() => toggleGenre(genre)}
                    className={isSelected ? "genre-chip active" : "genre-chip"}
                  >
                    {genre.genre_name}
                  </span>
                );
              })}
            </div>
            <Form.Text className="text-muted">
              Click to select genres for this movie.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Admin Review <span className="text-muted">(Optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Write official review here... AI will analyze sentiment and assign a ranking automatically."
              value={adminReview}
              onChange={(e) => setAdminReview(e.target.value)}
              style={{ resize: "vertical" }}
            />
            <Form.Text className="text-muted">
              <strong>AI-Powered Ranking:</strong> Your review will be analyzed
              to automatically assign a ranking (Masterpiece, Must-See, etc.)
            </Form.Text>
          </Form.Group>

          <Button
            variant="primary"
            type="submit"
            className="w-100 mb-2"
            disabled={loading}
            style={{ fontWeight: 600, letterSpacing: 1 }}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Adding...
              </>
            ) : (
              "Add Movie"
            )}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default AddMovie;
