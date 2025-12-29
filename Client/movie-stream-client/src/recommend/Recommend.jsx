import useAxiosPrivate from "../hook/useAxiosPrivate";
import { useEffect, useState } from "react";
import Movies from "../components/movies/Movies";
import Loading from "../components/loading/Loading";

const Recommend = () => {
  const axiosPrivate = useAxiosPrivate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchRecommendedMovies = async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await axiosPrivate.get("/recommendedmovies");
        setMovies(response.data);
      } catch (error) {
        setMessage(
          "Failed to load recommendations. Make sure you have your favorite genres chosen."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendedMovies();
  }, []);
  if (loading) return <Loading />;

  return <Movies movies={movies} message={message} />;
};
export default Recommend;
