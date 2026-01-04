import Movie from "../movie/Movie";
import { Pagination } from "react-bootstrap";

const Movies = ({
  movies,
  updateMovieReview,
  message,
  currentPage,
  totalPages,
  total,
  onPageChange,
}) => {
  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      // Show smart pagination with ellipsis
      if (currentPage <= 3) {
        // Near start
        for (let i = 1; i <= 4; i++) items.push(i);
        items.push("...");
        items.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end
        items.push(1);
        items.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) items.push(i);
      } else {
        // In the middle
        items.push(1);
        items.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) items.push(i);
        items.push("...");
        items.push(totalPages);
      }
    }

    return items;
  };

  return (
    <div className="container mt-4">
      <div className="row">
        {movies && movies.length > 0 ? (
          <>
            {movies.map((movie) => (
              <Movie
                key={movie._id}
                updateMovieReview={updateMovieReview}
                movie={movie}
              />
            ))}
          </>
        ) : (
          <h2>{message}</h2>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center mt-4 mb-4">
          <Pagination>
            <Pagination.First
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
            />
            <Pagination.Prev
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            />

            {getPaginationItems().map((item, index) =>
              item === "..." ? (
                <Pagination.Ellipsis key={`ellipsis-${index}`} disabled />
              ) : (
                <Pagination.Item
                  key={item}
                  active={item === currentPage}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Pagination.Item>
              )
            )}

            <Pagination.Next
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            />
            <Pagination.Last
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
            />
          </Pagination>
        </div>
      )}

      {/* Page Info */}
      {total > 0 && (
        <div className="text-center text-muted mb-4">
          Showing page {currentPage} of {totalPages} ({total} movies total)
        </div>
      )}
    </div>
  );
};
export default Movies;
