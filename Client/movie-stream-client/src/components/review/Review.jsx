import { Form, Button, Card } from "react-bootstrap";
import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useAxiosPrivate from "../../hook/useAxiosPrivate";
import Loading from "../loading/Loading";
import useAuth from "../../hook/useAuth";
import Movie from "../movie/Movie";

// Mock user reviews for UI/UX demonstration
const mockUserReviews = [
  {
    id: 1,
    username: "MovieFan123",
    rating: 4.5,
    date: "Dec 28, 2025",
    comment:
      "Absolutely loved this movie! The cinematography was stunning and the storyline kept me engaged throughout.",
    avatar: "https://ui-avatars.com/api/?name=MF&background=random",
  },
  {
    id: 2,
    username: "CinemaLover",
    rating: 4.0,
    date: "Dec 25, 2025",
    comment:
      "Great performances by the cast. A must-watch for anyone who appreciates quality filmmaking.",
    avatar: "https://ui-avatars.com/api/?name=CL&background=random",
  },
  {
    id: 3,
    username: "FilmCritic99",
    rating: 3.5,
    date: "Dec 20, 2025",
    comment:
      "Solid movie with some pacing issues in the middle. Overall an enjoyable experience.",
    avatar: "https://ui-avatars.com/api/?name=FC&background=random",
  },
];

const StarRating = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <span className="text-warning">
      {"★".repeat(fullStars)}
      {hasHalfStar && "½"}
      {"☆".repeat(emptyStars)}
      <span className="text-muted ms-1">({rating})</span>
    </span>
  );
};

const Review = () => {
  const [movie, setMovie] = useState({});
  const [loading, setLoading] = useState(false);
  const [userReviewText, setUserReviewText] = useState("");
  const [userRating, setUserRating] = useState(5);
  const revText = useRef();
  const { imdb_id } = useParams();
  const { auth, setAuth } = useAuth();
  const axiosPrivate = useAxiosPrivate();

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true);
      try {
        const response = await axiosPrivate.get(`/movies/${imdb_id}`);
        setMovie(response.data);
        console.log(response.data);
      } catch (error) {
        console.error("Error fetching movie:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    try {
      const response = await axiosPrivate.patch(`/updatereview/${imdb_id}`, {
        admin_review: revText.current.value,
      });
      console.log(response.data);

      setMovie(() => ({
        ...movie,
        admin_review: response.data?.admin_review ?? movie.admin_review,
        ranking: {
          ranking_name:
            response.data?.ranking_name ?? movie.ranking?.ranking_name,
        },
      }));
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        console.error("Unauthorized access - redirecting to login");
        localStorage.removeItem("user");
        // setAuth(null);
      } else {
        console.error("Error updating review:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserReviewSubmit = (e) => {
    e.preventDefault();
    // UI only - no real functionality yet
    alert("Review submitted! (This is just a UI demo)");
    setUserReviewText("");
    setUserRating(5);
  };

  // Admin View
  const AdminReviewPanel = () => (
    <div className="w-100 glass-panel p-4">
      <h4 className="mb-3">
        <i className="bi bi-pencil-square me-2"></i>Admin Review
      </h4>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="adminReviewTextarea">
          <Form.Label>Write Official Review</Form.Label>
          <Form.Control
            ref={revText}
            required
            as="textarea"
            rows={8}
            defaultValue={movie?.admin_review}
            placeholder="Write your official review here..."
            style={{ resize: "vertical" }}
          />
        </Form.Group>
        <div className="d-flex justify-content-end">
          <Button variant="info" type="submit">
            Submit Review
          </Button>
        </div>
      </Form>
    </div>
  );

  // User View
  const UserReviewPanel = () => (
    <div className="w-100">
      {/* Watch Reviews Box - Admin Review */}
      <Card className="shadow mb-4 glass-panel">
        <Card.Header className="review-card-header text-white">
          <h5 className="mb-0">
            <i className="bi bi-play-circle me-2"></i>Watch Reviews
          </h5>
        </Card.Header>
        <Card.Body>
          <div className="d-flex align-items-start mb-3">
            <div className="review-avatar text-white rounded-circle d-flex align-items-center justify-content-center me-3">
              <strong>A</strong>
            </div>
            <div>
              <h6 className="mb-1">
                <span className="badge bg-danger me-2">Official</span>
                Admin Review
              </h6>
              <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                {movie.admin_review ||
                  "No official review yet. Check back later!"}
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* User Reviews Section */}
      <Card className="shadow mb-4 glass-panel">
        <Card.Header className="review-card-header-muted text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-chat-dots me-2"></i>User Reviews
          </h5>
          <span className="badge review-count-badge">
            {mockUserReviews.length} reviews
          </span>
        </Card.Header>
        <Card.Body style={{ maxHeight: "400px", overflowY: "auto" }}>
          {mockUserReviews.map((review) => (
            <div
              key={review.id}
              className="d-flex align-items-start mb-3 pb-3 border-bottom review-item"
            >
              <img
                src={review.avatar}
                alt={review.username}
                className="rounded-circle me-3"
                style={{ width: "45px", height: "45px" }}
              />
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h6 className="mb-0">{review.username}</h6>
                  <small className="text-muted">{review.date}</small>
                </div>
                <div className="mb-2">
                  <StarRating rating={review.rating} />
                </div>
                <p className="mb-0 text-muted" style={{ fontSize: "0.9rem" }}>
                  {review.comment}
                </p>
              </div>
            </div>
          ))}
        </Card.Body>
      </Card>

      {/* Write Your Review Section */}
      <Card className="shadow glass-panel">
        <Card.Header className="review-card-header-success text-white">
          <h5 className="mb-0">
            <i className="bi bi-pencil me-2"></i>Write Your Review
          </h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleUserReviewSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Your Rating</Form.Label>
              <div className="d-flex align-items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => setUserRating(star)}
                    style={{ cursor: "pointer", fontSize: "1.5rem" }}
                    className={
                      star <= userRating ? "text-warning" : "text-muted"
                    }
                  >
                    ★
                  </span>
                ))}
                <span className="ms-2 text-muted">({userRating}/5)</span>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Your Review</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={userReviewText}
                onChange={(e) => setUserReviewText(e.target.value)}
                placeholder="Share your thoughts about this movie..."
                style={{ resize: "vertical" }}
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button variant="success" type="submit">
                Submit Review
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );

  return (
    <>
      {loading ? (
        <Loading />
      ) : (
        <div className="container py-5">
          <h2 className="text-center mb-4">
            {auth?.role === "ADMIN" ? "Admin Review" : "Movie Reviews"}
          </h2>
          <div className="row justify-content-center">
            <div className="col-12 col-md-4 d-flex align-items-start justify-content-center mb-4 mb-md-0">
              <div className="w-100 sticky-top" style={{ top: "20px" }}>
                <Movie movie={movie} fullWidth />
              </div>
            </div>
            <div className="col-12 col-md-8 d-flex align-items-stretch">
              {auth?.role === "ADMIN" ? (
                <AdminReviewPanel />
              ) : (
                <UserReviewPanel />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Review;
