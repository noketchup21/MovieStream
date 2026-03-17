import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosConfig";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const Home = () => {
  const [backgroundMovies, setBackgroundMovies] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);

  const getPosterUrl = (posterPath) => {
    if (!posterPath) return "";
    if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
      return posterPath;
    }
    if (posterPath.startsWith("//")) {
      return `https:${posterPath}`;
    }
    if (apiBaseUrl) {
      try {
        return new URL(posterPath, apiBaseUrl).toString();
      } catch {
        return posterPath;
      }
    }
    return posterPath;
  };

  useEffect(() => {
    const loadBackgroundTitles = async () => {
      try {
        const response = await axiosClient.get("/movies", {
          params: { page: 1, limit: 18 },
        });
        const fetchedMovies = response?.data?.movies || [];
        setBackgroundMovies(fetchedMovies);
      } catch (error) {
        console.error("Failed to load background slides:", error);
      }
    };

    loadBackgroundTitles();
  }, []);

  const slideImages = useMemo(() => {
    if (!backgroundMovies.length) {
      return [];
    }

    const moviesWithPoster = backgroundMovies
      .map((movie) => ({
        ...movie,
        poster_path: getPosterUrl(movie.poster_path),
      }))
      .filter((movie) => !!movie.poster_path);

    if (!moviesWithPoster.length) {
      return [];
    }

    const animeTagged = moviesWithPoster.filter((movie) => {
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
    });

    const preferred = animeTagged.length >= 3 ? animeTagged : moviesWithPoster;
    return preferred
      .slice(0, 5)
      .map((movie) => ({
        id: movie._id || movie.imdb_id,
        title: movie.title,
        url: movie.poster_path,
      }))
      .filter((item) => !!item.url);
  }, [backgroundMovies]);

  const moviesWithPoster = useMemo(
    () =>
      backgroundMovies
        .map((movie) => ({
          ...movie,
          poster_path: getPosterUrl(movie.poster_path),
        }))
        .filter((movie) => !!movie.poster_path),
    [backgroundMovies],
  );

  const animeTitles = useMemo(() => {
    return moviesWithPoster.filter((movie) => {
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
    });
  }, [moviesWithPoster]);

  const showcaseMovies = moviesWithPoster.slice(0, 5);
  const animePicks = animeTitles.slice(0, 5);

  const heroFocus = slideImages[activeSlide] || moviesWithPoster[0] || null;

  useEffect(() => {
    if (slideImages.length === 0) {
      setActiveSlide(0);
      return;
    }
    if (activeSlide >= slideImages.length) {
      setActiveSlide(0);
    }
  }, [slideImages, activeSlide]);

  useEffect(() => {
    if (slideImages.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideImages.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [slideImages]);

  return (
    <>
      <section className="container mt-4 mb-4">
        <div className="home-hero imagery-home glass-panel p-0 p-md-0">
          {slideImages.length > 0 && (
            <div className="hero-bg-slideshow" aria-hidden="true">
              {slideImages.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`hero-bg-slide ${index === activeSlide ? "active" : ""}`}
                  style={{ backgroundImage: `url(${slide.url})` }}
                />
              ))}
              <div className="hero-bg-overlay" />
            </div>
          )}
          <div className="home-hero-content">
            <div className="hero-floating-card">
              <span className="hero-kicker">MovieStream Visual Hub</span>
              <h1 className="hero-title mt-3 mb-2">
                Watch By Vibe, Not By Long Descriptions
              </h1>
              <p className="hero-subtitle mb-3">
                Explore posters, pick a title, and start streaming.
              </p>
              {heroFocus?.title && (
                <p className="hero-mini-meta mb-3">
                  Now in focus: {heroFocus.title}
                </p>
              )}
              <div className="landing-actions d-flex flex-wrap gap-2">
                <Link to="/browse" className="btn btn-primary btn-lg">
                  Open Visual Library
                </Link>
                <Link to="/recommend" className="btn btn-outline-light btn-lg">
                  Get Recommendations
                </Link>
              </div>
              {slideImages.length > 1 && (
                <div
                  className="hero-slide-indicators mt-4"
                  aria-label="Background slide indicators"
                >
                  {slideImages.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      className={`slide-dot ${index === activeSlide ? "active" : ""}`}
                      onClick={() => setActiveSlide(index)}
                      aria-label={`Show slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="hero-quick-grid">
              {showcaseMovies.slice(0, 4).map((movie) => (
                <Link
                  key={movie._id || movie.imdb_id}
                  to="/browse"
                  className="hero-quick-poster"
                  title={movie.title}
                >
                  <img src={movie.poster_path} alt={movie.title} />
                </Link>
              ))}
              {showcaseMovies.length === 0 && (
                <div className="hero-quick-fallback">
                  New visuals loading...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container mb-4">
        <div className="visual-category-grid">
          <Link to="/browse" className="visual-tile glass-panel">
            <img
              src={showcaseMovies[0]?.poster_path}
              alt="Movies"
              className="visual-tile-image"
            />
            <div className="visual-tile-overlay">
              <h3>Movies</h3>
            </div>
          </Link>
          <Link to="/browse" className="visual-tile glass-panel">
            <img
              src={animePicks[0]?.poster_path || showcaseMovies[1]?.poster_path}
              alt="Anime"
              className="visual-tile-image"
            />
            <div className="visual-tile-overlay">
              <h3>Anime</h3>
            </div>
          </Link>
          <Link to="/recommend" className="visual-tile glass-panel">
            <img
              src={showcaseMovies[2]?.poster_path}
              alt="Recommendations"
              className="visual-tile-image"
            />
            <div className="visual-tile-overlay">
              <h3>For You</h3>
            </div>
          </Link>
        </div>
      </section>
    </>
  );
};
export default Home;
