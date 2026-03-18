import { useEffect, useMemo, useState } from "react";
import { Button, Container, Form, Pagination } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosConfig";
import useAuth from "../../hook/useAuth";
import useAxiosPrivate from "../../hook/useAxiosPrivate";

const EditMovie = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();
  const isAdmin =
    String(auth?.role || "")
      .trim()
      .toUpperCase() === "ADMIN";

  const [movies, setMovies] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [selectedImdbId, setSelectedImdbId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [posterPath, setPosterPath] = useState("");
  const [youtubeId, setYoutubeId] = useState("");
  const [adminReview, setAdminReview] = useState("");
  const [initialAdminReview, setInitialAdminReview] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);

  const [loadingMovies, setLoadingMovies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 8;

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.imdb_id === selectedImdbId),
    [movies, selectedImdbId],
  );

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await axiosClient.get("/genres");
        setAvailableGenres(response.data || []);
      } catch (err) {
        console.error("Error fetching genres:", err);
      }
    };

    fetchGenres();
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoadingMovies(true);
      setError("");

      try {
        const response = await axiosClient.get("/movies", {
          params: { page: currentPage, limit },
        });

        const fetchedMovies = response.data?.movies || [];
        setMovies(fetchedMovies);
        setTotalPages(response.data?.totalPages || 1);

        if (fetchedMovies.length === 0) {
          setSelectedImdbId("");
        } else if (
          !fetchedMovies.some((movie) => movie.imdb_id === selectedImdbId)
        ) {
          hydrateFormFromMovie(fetchedMovies[0]);
        }
      } catch (err) {
        console.error("Error fetching movies:", err);
        setError("Failed to load movies.");
      } finally {
        setLoadingMovies(false);
      }
    };

    fetchMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const hydrateFormFromMovie = (movie) => {
    if (!movie) return;

    setSelectedImdbId(movie.imdb_id || "");
    setTitle(movie.title || "");
    setDescription(movie.description || "");
    setPosterPath(movie.poster_path || "");
    setYoutubeId(movie.youtube_id || "");
    setAdminReview(movie.admin_review || "");
    setInitialAdminReview(movie.admin_review || "");
    setSelectedGenres(
      Array.isArray(movie.genre)
        ? movie.genre.map((genre) => ({
            genre_id: genre.genre_id,
            genre_name: genre.genre_name,
          }))
        : [],
    );
  };

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) => {
      const exists = prev.some((item) => item.genre_id === genre.genre_id);
      if (exists) {
        return prev.filter((item) => item.genre_id !== genre.genre_id);
      }

      return [
        ...prev,
        { genre_id: genre.genre_id, genre_name: genre.genre_name },
      ];
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!selectedImdbId) {
      setError("Please select a movie to edit.");
      return;
    }

    if (selectedGenres.length === 0) {
      setError("Please select at least one genre.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        poster_path: posterPath.trim(),
        youtube_id: youtubeId.trim(),
        genre: selectedGenres,
      };

      const updateMovieResponse = await axiosPrivate.patch(
        `/updatemovie/${selectedImdbId}`,
        payload,
      );

      let rankingMessage = "";
      const nextReview = adminReview.trim();
      if (nextReview && nextReview !== initialAdminReview.trim()) {
        const updateReviewResponse = await axiosPrivate.patch(
          `/updatereview/${selectedImdbId}`,
          { admin_review: nextReview },
        );

        rankingMessage = updateReviewResponse.data?.ranking_name
          ? ` AI ranking updated to: ${updateReviewResponse.data.ranking_name}.`
          : "";
      }

      const updatedMovie = updateMovieResponse.data?.movie;
      if (updatedMovie) {
        setMovies((prev) =>
          prev.map((movie) =>
            movie.imdb_id === selectedImdbId ? updatedMovie : movie,
          ),
        );
        hydrateFormFromMovie(updatedMovie);
      }

      setSuccess(`Movie updated successfully.${rankingMessage}`);
    } catch (err) {
      console.error("Error updating movie:", err);
      setError(err.response?.data?.error || "Failed to update movie.");
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 className="mb-1">Edit Movies</h2>
          <p className="text-muted mb-0">
            Select a movie from the list and update its details.
          </p>
        </div>
        <Button
          variant="outline-light"
          onClick={() => navigate("/admin/add-movie")}
        >
          Add New Movie
        </Button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="glass-panel p-3 h-100">
            <h5 className="mb-3">Movie List</h5>
            {loadingMovies ? (
              <p className="text-muted mb-0">Loading movies...</p>
            ) : movies.length === 0 ? (
              <p className="text-muted mb-0">No movies found.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {movies.map((movie) => {
                  const isActive = selectedImdbId === movie.imdb_id;
                  return (
                    <button
                      key={movie.imdb_id}
                      type="button"
                      className={`btn text-start ${isActive ? "btn-primary" : "btn-outline-light"}`}
                      onClick={() => hydrateFormFromMovie(movie)}
                    >
                      <div className="fw-semibold text-truncate">
                        {movie.title}
                      </div>
                      <small className={isActive ? "text-light" : "text-muted"}>
                        {movie.imdb_id}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <Pagination className="mb-0">
                  <Pagination.Prev
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  />
                  <Pagination.Item active>{currentPage}</Pagination.Item>
                  <Pagination.Next
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  />
                </Pagination>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-7">
          <div className="glass-panel p-3 p-md-4 h-100">
            <h5 className="mb-3">Edit Details</h5>
            {!selectedMovie ? (
              <p className="text-muted mb-0">
                Select a movie from the list to edit.
              </p>
            ) : (
              <Form onSubmit={handleSave}>
                <Form.Group className="mb-3">
                  <Form.Label>IMDb ID</Form.Label>
                  <Form.Control value={selectedImdbId} disabled />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Movie synopsis..."
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Poster URL</Form.Label>
                  <Form.Control
                    type="url"
                    value={posterPath}
                    onChange={(e) => setPosterPath(e.target.value)}
                    required
                  />
                </Form.Group>

                {posterPath && (
                  <div className="mb-3 text-center">
                    <img
                      src={posterPath}
                      alt="Poster preview"
                      style={{ maxHeight: 220, objectFit: "contain" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>YouTube Trailer ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={youtubeId}
                    onChange={(e) => setYoutubeId(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Genres</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {availableGenres.map((genre) => {
                      const isSelected = selectedGenres.some(
                        (item) => item.genre_id === genre.genre_id,
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

                <Form.Group className="mb-3">
                  <Form.Label>Admin Review (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={adminReview}
                    onChange={(e) => setAdminReview(e.target.value)}
                    placeholder="Update review text to recalculate AI ranking"
                  />
                  <Form.Text className="text-muted">
                    Ranking is recalculated only when review text changes and is
                    not empty.
                  </Form.Text>
                </Form.Group>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-100"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </Form>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default EditMovie;
