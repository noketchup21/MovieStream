import Button from "react-bootstrap/Button";
import { Link } from "react-router-dom";

const Movie = ({ movie, updateMovieReview, fullWidth = false }) => {
  const cardContent = (
    <div key={movie._id}>
      <Link
        to={`/stream/${movie.imdb_id}`}
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
            <p className="card-text movie-id-text mb-2">{movie.imdb_id}</p>
          </div>
          {movie.ranking?.ranking_name && (
            <span
              className="badge movie-rank-badge m-3 p-2"
              style={{ fontSize: "1rem" }}
            >
              {movie.ranking.ranking_name}
            </span>
          )}
          {updateMovieReview && (
            <Button
              variant="outline-info"
              onClick={(e) => {
                e.preventDefault();
                updateMovieReview(movie.imdb_id);
              }}
              className="m-3"
            >
              Review
            </Button>
          )}
        </div>
      </Link>
    </div>
  );

  if (fullWidth) {
    return <div className="w-100">{cardContent}</div>;
  }

  return <div className="col-md-4 mb-4">{cardContent}</div>;
};
export default Movie;
