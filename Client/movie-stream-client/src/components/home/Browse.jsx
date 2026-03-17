import { useState, useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import axiosClient from "../../api/axiosConfig";
import Movies from "../movies/Movies.jsx";
import Loading from "../loading/Loading.jsx";

const Browse = ({ updateMovieReview }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState();
  const [selectedCategory, setSelectedCategory] = useState("movie");
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

  const fetchMovies = async (page) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await axiosClient.get("/movies", {
        params: { page, limit },
      });
      setMovies(response.data.movies);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);
      if (response.data.movies.length === 0) {
        setMessage("No movies available");
      }
    } catch (error) {
      console.error("Error fetching movies:", error);
      setMessage("Failed to load movies. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies(currentPage);
  }, [currentPage]);

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

  return loading ? (
    <Loading />
  ) : (
    <>
      <section className="container mt-4 mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
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
      </section>

      <Movies
        movies={filteredMovies}
        updateMovieReview={updateMovieReview}
        message={libraryMessage}
        currentPage={selectedCategory === "anime" ? 1 : currentPage}
        totalPages={selectedCategory === "anime" ? 1 : totalPages}
        total={selectedCategory === "anime" ? filteredMovies.length : total}
        showPagination={selectedCategory !== "anime"}
        onPageChange={handlePageChange}
      />
    </>
  );
};

export default Browse;
