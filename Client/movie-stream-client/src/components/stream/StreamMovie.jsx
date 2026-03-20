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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

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
      setIframeLoaded(false);
      setIframeFailed(false);
      try {
        // Fetch the embed URL for the movie and vietsub
        const res = await axiosClient.get("/getembedmovie", {
          params: {
            imdb: imdb_id,
          },
        });

        const candidate = String(res?.data?.embed_url || "").trim();
        const parsed = new URL(candidate);

        if (parsed.protocol !== "https:") {
          throw new Error("Embed URL must use HTTPS");
        }

        setEmbedUrl(candidate);
      } catch (err) {
        console.error("Error fetching embed URL:", err);

        if (err.response?.status === 401) {
          setError("Unauthorized. Please login again.");
        } else {
          setError("Failed to load movie player. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    playMovie();
  }, [imdb_id]);

  useEffect(() => {
    if (!embedUrl) return undefined;

    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true);
      }
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [embedUrl, iframeLoaded]);

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
              allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *"
              allowFullScreen
              webkitAllowFullScreen
              mozAllowFullScreen
              title="Movie stream player"
              referrerPolicy="origin"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeFailed(false);
              }}
              onError={() => {
                setIframeFailed(true);
              }}
            />
          </div>
          {iframeFailed && (
            <div className="alert alert-warning mt-3 mb-0">
              Embedded playback may be blocked by your browser or the provider.
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default StreamMovie;
