import { useState, useEffect } from "react";
import axiosClient from "../../api/axiosConfig";
import Movies from "../movies/Movies.jsx";
import Loading from "../loading/Loading.jsx";

const Home = ({ updateMovieReview }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState();

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await axiosClient.get("/movies");
        setMovies(response.data);
        if (response.data.length === 0) {
          setMessage("No movies available");
        }
      } catch (error) {
        console.error("Error fetching movies:", error);
        setMessage("Failed to load movies. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

  return loading ? (
    <Loading />
  ) : (
    <Movies
      movies={movies}
      updateMovieReview={updateMovieReview}
      message={message}
    />
  );
};
export default Home;
