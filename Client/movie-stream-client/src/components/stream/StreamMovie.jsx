import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../loading/Loading.jsx";
import axiosClient from "../../api/axiosConfig";
import useAuth from "../../hook/useAuth";
import {
  isMovieInLibrary,
  removeMovieFromLibrary,
  saveMovieToLibrary,
} from "../../utils/libraryStorage";

function StreamMovie() {
  const { imdb_id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [embedUrl, setEmbedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [movieInfo, setMovieInfo] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/browse");
  };

  useEffect(() => {
    setIsSaved(isMovieInLibrary(auth?.user_id, imdb_id));
  }, [auth?.user_id, imdb_id]);

  useEffect(() => {
    const loadMovieInfo = async () => {
      if (!imdb_id) return;

      try {
        const response = await axiosClient.get(`/movies/${imdb_id}`);
        setMovieInfo(response.data);
      } catch {
        setMovieInfo({ imdb_id, title: imdb_id });
      }
    };

    loadMovieInfo();
  }, [imdb_id]);

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

  const handleLibraryToggle = () => {
    if (!auth?.user_id || !movieInfo?.imdb_id) return;

    if (isSaved) {
      removeMovieFromLibrary(auth.user_id, movieInfo.imdb_id);
      setIsSaved(false);
    } else {
      saveMovieToLibrary(auth.user_id, movieInfo);
      setIsSaved(true);
    }

    window.dispatchEvent(new Event("library-updated"));
  };

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
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={handleBack}
          >
            Back
          </button>
          {auth?.user_id && (
            <button
              type="button"
              className={`btn ${isSaved ? "btn-light" : "btn-outline-light"}`}
              onClick={handleLibraryToggle}
            >
              <i
                className={`bi ${isSaved ? "bi-bookmark-check-fill" : "bi-bookmark-plus"} me-2`}
                aria-hidden="true"
              />
              {isSaved ? "Saved in Library" : "Save to Library"}
            </button>
          )}
        </div>
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
