import { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import axiosClient from "../../api/axiosConfig";
import Movies from "../movies/Movies.jsx";
import Loading from "../loading/Loading.jsx";

const Browse = ({ updateMovieReview }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [message, setMessage] = useState();
  const [selectedCategory, setSelectedCategory] = useState("movie");
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 9;

  const isAnimeMovie = (movie) => {
    const title = movie?.title?.toLowerCase() || "";
    const genres = Array.isArray(movie?.genre)
      ? movie.genre
          .map((item) =>
            typeof item === "string"
              ? item.toLowerCase()
              : item?.genre_name?.toLowerCase() || "",
          )
          .join(" ")
      : "";

    return /anime|animation|manga/.test(`${title} ${genres}`);
  };

  const doesMovieMatchSearch = (movie, search) => {
    const keyword = (search || "").trim().toLowerCase();
    if (!keyword) return true;

    const searchableText = [movie?.title, movie?.imdb_id, movie?.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  };

  const fetchMovies = async (page, search) => {
    setLoading(true);
    setMessage("");
    try {
      const trimmedSearch = search?.trim();

      if (trimmedSearch) {
        const response = await axiosClient.get("/movies", {
          params: { page: 1, limit: 5000 },
        });

        const allMovies = response.data?.movies || [];
        const matchedMovies = allMovies.filter((movie) =>
          doesMovieMatchSearch(movie, trimmedSearch),
        );

        const totalMatched = matchedMovies.length;
        const computedTotalPages = Math.max(1, Math.ceil(totalMatched / limit));
        const safePage = Math.min(page, computedTotalPages);
        const start = (safePage - 1) * limit;
        const pagedMovies = matchedMovies.slice(start, start + limit);

        setMovies(pagedMovies);
        setTotalPages(computedTotalPages);
        setTotal(totalMatched);

        if (safePage !== page) {
          setCurrentPage(safePage);
        }

        if (totalMatched === 0) {
          setMessage(`No movies found for "${trimmedSearch}"`);
        }
      } else {
        const response = await axiosClient.get("/movies", {
          params: { page, limit },
        });
        setMovies(response.data.movies);
        setTotalPages(response.data.totalPages);
        setTotal(response.data.total);
        if (response.data.movies.length === 0) {
          setMessage("No movies available");
        }
      }
    } catch (error) {
      console.error("Error fetching movies:", error);
      setMessage("Failed to load movies. Please try again later.");
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchText);
    }, 350);

    return () => clearTimeout(debounceTimer);
  }, [searchText]);

  useEffect(() => {
    fetchMovies(currentPage, searchQuery);
  }, [currentPage, searchQuery]);

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const filteredMovies =
    selectedCategory === "anime"
      ? movies.filter((movie) => isAnimeMovie(movie))
      : movies;
  const libraryMessage =
    selectedCategory === "anime"
      ? "No anime titles found on this page. Try another page or switch to Movie."
      : message;

  return isInitialLoad && loading ? (
    <Loading />
  ) : (
    <>
      <section className="container mt-4 mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <div>
            <h2 className="mb-1">Watch Now</h2>
            <p className="text-muted mb-0">
              Browse all titles and switch between Movie and Anime categories.
            </p>
          </div>
          <Dropdown>
            <Dropdown.Toggle variant="primary" id="category-dropdown">
              {selectedCategory === "anime" ? "Anime" : "Movie"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setSelectedCategory("movie")}>
                Movie
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSelectedCategory("anime")}>
                Anime
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <div className="browse-search-wrap">
          <div className="browse-search-shell">
            <i className="bi bi-search browse-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="form-control browse-search-input"
              placeholder="Search by title, IMDb ID, or description..."
              value={searchText}
              onChange={handleSearchChange}
              aria-label="Search movies"
            />
            {loading && !isInitialLoad && (
              <span className="browse-search-spinner" aria-hidden="true">
                <span className="spinner-border spinner-border-sm" />
              </span>
            )}
            {searchText.trim() && (
              <button
                type="button"
                className="browse-search-clear"
                onClick={() => {
                  setSearchText("");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                aria-label="Clear search"
                title="Clear search"
              >
                <i className="bi bi-x-circle-fill" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </section>

      <Movies
        movies={filteredMovies}
        updateMovieReview={updateMovieReview}
        message={libraryMessage}
        currentPage={selectedCategory === "anime" ? 1 : currentPage}
        totalPages={selectedCategory === "anime" ? 1 : totalPages}
        total={selectedCategory === "anime" ? filteredMovies.length : total}
        showPagination={selectedCategory !== "anime" && totalPages > 1}
        onPageChange={handlePageChange}
      />
    </>
  );
};

export default Browse;
