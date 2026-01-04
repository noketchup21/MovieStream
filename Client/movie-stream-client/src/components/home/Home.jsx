import { useState, useEffect } from "react";
import axiosClient from "../../api/axiosConfig";
import Movies from "../movies/Movies.jsx";
import Loading from "../loading/Loading.jsx";

const Home = ({ updateMovieReview }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 9;

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

  return loading ? (
    <Loading />
  ) : (
    <Movies
      movies={movies}
      updateMovieReview={updateMovieReview}
      message={message}
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      onPageChange={handlePageChange}
    />
  );
};
export default Home;
