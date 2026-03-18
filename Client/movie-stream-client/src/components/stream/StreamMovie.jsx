import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../loading/Loading.jsx";
import axiosClient from "../../api/axiosConfig";

function StreamMovie() {
  const { imdb_id } = useParams();
  const navigate = useNavigate();
  const [embedUrl, setEmbedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/browse");
  };

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
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-light"
          onClick={handleBack}
        >
          Back
        </button>
      </div>
      {isLoading && <Loading />}
      {error && <div className="alert alert-danger">{error}</div>}
      {!isLoading && embedUrl && (
        <>
          <div className="iframe-shell">
            <iframe
              src={embedUrl}
              className="stream-iframe"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              webkitAllowFullScreen
              mozAllowFullScreen
              title="Movie stream player"
            />
          </div>
          <div className="mt-3 d-md-none">
            <button
              type="button"
              className="btn btn-outline-light w-100"
              onClick={() =>
                window.open(embedUrl, "_blank", "noopener,noreferrer")
              }
            >
              Open player in new tab (mobile fullscreen fallback)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export default StreamMovie;
