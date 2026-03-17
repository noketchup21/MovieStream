import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Loading from "../loading/Loading.jsx";
import axiosClient from "../../api/axiosConfig";

function StreamMovie() {
  const { imdb_id } = useParams();
  const [embedUrl, setEmbedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const playMovie = async () => {
      if (!imdb_id) return;

      setIsLoading(true);
      setError(null);
      try {
        // Fetch the embed URL for the movie and vietsub
        const res = await axiosClient.get(
          `/getembedmovie?imdb=${imdb_id}&ds_lang=vi&autoplay=1`,
        );
        setEmbedUrl(res.data.embed_url);
      } catch (err) {
        console.error("Error fetching embed URL:", err);
        setError("Failed to load movie. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    playMovie();
  }, [imdb_id]);

  return (
    <div className="container mt-4 pb-4">
      {isLoading && <Loading />}
      {error && <div className="alert alert-danger">{error}</div>}
      {!isLoading && embedUrl && (
        <div className="iframe-shell">
          <iframe
            src={embedUrl}
            width="100%"
            height="600"
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ border: "none" }}
          />
        </div>
      )}
    </div>
  );
}
export default StreamMovie;
