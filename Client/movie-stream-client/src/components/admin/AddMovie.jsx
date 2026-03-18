import { useState, useEffect } from "react";
import { Button, Container, Form } from "react-bootstrap";
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
    <Container className="py-4 py-lg-5">
      <div className="glass-panel add-movie-shell p-3 p-md-4 p-xl-5">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <div className="d-flex align-items-center gap-3 mb-2">
              <img src={logo} alt="Logo" width={56} height={56} />
              <div>
                <h2 className="mb-1 fw-bold">Add Movie</h2>
                <p className="text-muted mb-0">
                  Expand your catalog with a new title.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline-light"
            onClick={() => navigate("/admin/edit-movies")}
          >
            Go To Edit Movies
          </Button>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        <Form onSubmit={handleSubmit}>
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="add-movie-pane p-3 p-md-4 h-100">
                <h5 className="mb-3">Movie Information</h5>

                <div className="row g-3">
                  <div className="col-md-8">
                    <Form.Group>
                      <Form.Label>Movie Title</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter movie title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <Form.Label>IMDb ID</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="tt1234567"
                        value={imdbId}
                        onChange={(e) => setImdbId(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>

                  <div className="col-12">
                    <Form.Group>
                      <Form.Label>Poster URL</Form.Label>
                      <Form.Control
                        type="url"
                        placeholder="https://..."
                        value={posterPath}
                        onChange={(e) => setPosterPath(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </div>

                  <div className="col-12">
                    <Form.Group>
                      <Form.Label>YouTube Trailer ID</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g., dQw4w9WgXcQ"
                        value={youtubeId}
                        onChange={(e) => setYoutubeId(e.target.value)}
                        required
                      />
                      <Form.Text className="text-muted">
                        Use only the value after v= from the YouTube URL.
                      </Form.Text>
                    </Form.Group>
                  </div>

                  <div className="col-12">
                    <Form.Group>
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
                              className={
                                isSelected ? "genre-chip active" : "genre-chip"
                              }
                            >
                              {genre.genre_name}
                            </span>
                          );
                        })}
                      </div>
                    </Form.Group>
                  </div>

                  <div className="col-12">
                    <Form.Group>
                      <Form.Label>
                        Admin Review{" "}
                        <span className="text-muted">(Optional)</span>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={6}
                        placeholder="Write an official review. AI will analyze sentiment and assign ranking."
                        value={adminReview}
                        onChange={(e) => setAdminReview(e.target.value)}
                        style={{ resize: "vertical" }}
                      />
                      <Form.Text className="text-muted">
                        Ranking is generated after save when review is provided.
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="add-movie-pane p-3 p-md-4 h-100 d-flex flex-column">
                <h5 className="mb-3">Live Preview</h5>
                <div className="add-movie-poster-wrap mb-3 d-flex align-items-center justify-content-center">
                  {posterPath ? (
                    <img
                      src={posterPath}
                      alt="Poster preview"
                      className="add-movie-poster"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <p className="text-muted mb-0 text-center small px-3">
                      Poster preview will appear here when you add a poster URL.
                    </p>
                  )}
                </div>

                <div className="small text-muted mb-3">
                  <div>
                    <strong>Title:</strong> {title || "-"}
                  </div>
                  <div>
                    <strong>IMDb:</strong> {imdbId || "-"}
                  </div>
                  <div>
                    <strong>Trailer:</strong> {youtubeId || "-"}
                  </div>
                  <div>
                    <strong>Genres:</strong>{" "}
                    {selectedGenres.length > 0
                      ? selectedGenres.map((g) => g.genre_name).join(", ")
                      : "-"}
                  </div>
                </div>

                <div className="mt-auto d-grid gap-2">
                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100"
                    disabled={loading}
                    style={{ fontWeight: 700, letterSpacing: 0.6 }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Adding Movie...
                      </>
                    ) : (
                      "Add Movie"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </Container>
  );
};

export default AddMovie;
