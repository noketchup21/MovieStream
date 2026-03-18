import Button from "react-bootstrap/Button";
import { Link } from "react-router-dom";

const Movie = ({ movie, updateMovieReview, fullWidth = false }) => {
  const cardContent = (
    <div key={movie._id} className="w-100 h-100">
      <Link
        to={`/stream/${movie.imdb_id}`}
        className="d-block h-100"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div className="card movie-card h-100 shadow-sm">
          <div style={{ position: "relative" }}>
            <img
              src={movie.poster_path}
              alt={movie.title}
              className="card-img-top"
              style={{
                objectFit: "contain",
                height: fullWidth ? "350px" : "250px",
                width: "100%",
              }}
            />
          </div>
          <div className="card-body d-flex flex-column">
            <h5 className="card-title movie-title">{movie.title}</h5>
            <p className="card-text movie-id-text mb-0">{movie.imdb_id}</p>
          </div>
          <div className="movie-card-meta px-3 pb-3 pt-1">
            <div className="movie-rank-slot mb-2">
              {movie.ranking?.ranking_name ? (
                <span className="badge movie-rank-badge p-2 w-100">
                  {movie.ranking.ranking_name}
                </span>
              ) : (
                <span className="movie-rank-placeholder" aria-hidden="true" />
              )}
            </div>

            {updateMovieReview && (
              <Button
                variant="outline-info"
                onClick={(e) => {
                  e.preventDefault();
                  updateMovieReview(movie.imdb_id);
                }}
                className="w-100"
              >
                Review
              </Button>
            )}
          </div>
        </div>
      </Link>
    </div>
  );

  if (fullWidth) {
    return <div className="w-100">{cardContent}</div>;
  }

  return <div className="col-md-4 mb-4 d-flex">{cardContent}</div>;
};
export default Movie;
