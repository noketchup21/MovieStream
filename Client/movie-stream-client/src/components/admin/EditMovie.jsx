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
  const [disabledMovies, setDisabledMovies] = useState([]);
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
  const [loadingDisabledMovies, setLoadingDisabledMovies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [activatingId, setActivatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [disabledCurrentPage, setDisabledCurrentPage] = useState(1);
  const [disabledTotalPages, setDisabledTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 8;

  const getPaginationItems = (page, pagesCount) => {
    if (pagesCount <= 7) {
      return Array.from({ length: pagesCount }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(pagesCount - 1, page + 1);

    if (start > 2) {
      pages.push("start-ellipsis");
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < pagesCount - 1) {
      pages.push("end-ellipsis");
    }

    pages.push(pagesCount);
    return pages;
  };

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
  }, [currentPage, refreshKey]);

  useEffect(() => {
    const fetchDisabledMovies = async () => {
      setLoadingDisabledMovies(true);

      try {
        const response = await axiosPrivate.get("/disabledmovies", {
          params: { page: disabledCurrentPage, limit },
        });

        const fetchedDisabledMovies = response.data?.movies || [];
        setDisabledMovies(fetchedDisabledMovies);
        setDisabledTotalPages(response.data?.totalPages || 1);

        if (fetchedDisabledMovies.length === 0 && disabledCurrentPage > 1) {
          setDisabledCurrentPage((prev) => Math.max(1, prev - 1));
        }
      } catch (err) {
        console.error("Error fetching disabled movies:", err);
      } finally {
        setLoadingDisabledMovies(false);
      }
    };

    fetchDisabledMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabledCurrentPage, refreshKey]);

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
      let reviewWarningMessage = "";
      const nextReview = adminReview.trim();
      if (nextReview && nextReview !== initialAdminReview.trim()) {
        try {
          const updateReviewResponse = await axiosPrivate.patch(
            `/updatereview/${selectedImdbId}`,
            { admin_review: nextReview },
          );

          rankingMessage = updateReviewResponse.data?.ranking_name
            ? ` AI ranking updated to: ${updateReviewResponse.data.ranking_name}.`
            : "";
        } catch (reviewErr) {
          reviewWarningMessage =
            reviewErr.response?.data?.error || "Review update failed.";
        }
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
      if (reviewWarningMessage) {
        setError(
          `Movie saved, but review was not updated: ${reviewWarningMessage}`,
        );
      }
    } catch (err) {
      console.error("Error updating movie:", err);
      setError(err.response?.data?.error || "Failed to update movie.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisableMovie = async () => {
    if (!selectedImdbId || disabling) {
      return;
    }

    const normalizedImdbId = selectedImdbId.trim();

    const confirmed = window.confirm(
      `Disable movie ${normalizedImdbId}? It will be hidden from browse and edit lists.`,
    );

    if (!confirmed) {
      return;
    }

    setDisabling(true);
    setError("");
    setSuccess("");

    const removeMovieFromCurrentPage = () => {
      const remainingMovies = movies.filter(
        (movie) => movie.imdb_id !== normalizedImdbId,
      );
      setMovies(remainingMovies);

      if (remainingMovies.length > 0) {
        hydrateFormFromMovie(remainingMovies[0]);
      } else if (currentPage > 1) {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else {
        setSelectedImdbId("");
      }
    };

    try {
      await axiosPrivate.patch(
        `/disablemovie/${encodeURIComponent(normalizedImdbId)}`,
        {},
      );

      removeMovieFromCurrentPage();
      setRefreshKey((prev) => prev + 1);

      setSuccess("Movie disabled successfully.");
    } catch (err) {
      console.error("Error disabling movie:", err);
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 404) {
        removeMovieFromCurrentPage();
        setRefreshKey((prev) => prev + 1);
        setSuccess("Movie is no longer available in the active list.");
        return;
      }

      setError(
        apiError ||
          `Failed to disable movie${status ? ` (HTTP ${status})` : ""}.`,
      );
    } finally {
      setDisabling(false);
    }
  };

  const handleEnableMovie = async (imdbId) => {
    if (!imdbId || activatingId) {
      return;
    }

    const normalizedImdbId = imdbId.trim();
    const confirmed = window.confirm(
      `Activate movie ${normalizedImdbId}? It will appear in browse and edit lists again.`,
    );

    if (!confirmed) {
      return;
    }

    setActivatingId(normalizedImdbId);
    setError("");
    setSuccess("");

    try {
      await axiosPrivate.patch(
        `/enablemovie/${encodeURIComponent(normalizedImdbId)}`,
        {},
      );

      setDisabledMovies((prev) =>
        prev.filter((movie) => movie.imdb_id !== normalizedImdbId),
      );
      setRefreshKey((prev) => prev + 1);
      setSuccess("Movie activated successfully.");
    } catch (err) {
      console.error("Error enabling movie:", err);
      const status = err.response?.status;
      const apiError = err.response?.data?.error;
      setError(
        apiError ||
          `Failed to activate movie${status ? ` (HTTP ${status})` : ""}.`,
      );
    } finally {
      setActivatingId("");
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
                  <Pagination.First
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  />
                  <Pagination.Prev
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  />
                  {getPaginationItems(currentPage, totalPages).map((item) =>
                    typeof item === "number" ? (
                      <Pagination.Item
                        key={item}
                        active={item === currentPage}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </Pagination.Item>
                    ) : (
                      <Pagination.Ellipsis key={item} disabled />
                    ),
                  )}
                  <Pagination.Next
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  />
                  <Pagination.Last
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  />
                </Pagination>
              </div>
            )}

            <hr className="my-4" />

            <h5 className="mb-3">Disabled Movies</h5>
            {loadingDisabledMovies ? (
              <p className="text-muted mb-0">Loading disabled movies...</p>
            ) : disabledMovies.length === 0 ? (
              <p className="text-muted mb-0">No disabled movies.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {disabledMovies.map((movie) => {
                  const isActivating = activatingId === movie.imdb_id;
                  return (
                    <div
                      key={movie.imdb_id}
                      className="d-flex align-items-center justify-content-between gap-2 border rounded p-2"
                    >
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">
                          {movie.title}
                        </div>
                        <small className="text-muted">{movie.imdb_id}</small>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-success"
                        onClick={() => handleEnableMovie(movie.imdb_id)}
                        disabled={Boolean(activatingId) || saving || disabling}
                      >
                        {isActivating ? "Activating..." : "Activate"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {disabledTotalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <Pagination className="mb-0">
                  <Pagination.First
                    disabled={disabledCurrentPage === 1}
                    onClick={() => setDisabledCurrentPage(1)}
                  />
                  <Pagination.Prev
                    disabled={disabledCurrentPage === 1}
                    onClick={() =>
                      setDisabledCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  />
                  {getPaginationItems(
                    disabledCurrentPage,
                    disabledTotalPages,
                  ).map((item) =>
                    typeof item === "number" ? (
                      <Pagination.Item
                        key={`disabled-${item}`}
                        active={item === disabledCurrentPage}
                        onClick={() => setDisabledCurrentPage(item)}
                      >
                        {item}
                      </Pagination.Item>
                    ) : (
                      <Pagination.Ellipsis key={`disabled-${item}`} disabled />
                    ),
                  )}
                  <Pagination.Next
                    disabled={disabledCurrentPage === disabledTotalPages}
                    onClick={() =>
                      setDisabledCurrentPage((prev) =>
                        Math.min(disabledTotalPages, prev + 1),
                      )
                    }
                  />
                  <Pagination.Last
                    disabled={disabledCurrentPage === disabledTotalPages}
                    onClick={() => setDisabledCurrentPage(disabledTotalPages)}
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

                <div className="d-flex flex-column flex-sm-row gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-100"
                    disabled={saving || disabling}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-danger"
                    className="w-100"
                    onClick={handleDisableMovie}
                    disabled={saving || disabling}
                  >
                    {disabling ? "Disabling..." : "Disable Movie"}
                  </Button>
                </div>
              </Form>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default EditMovie;
