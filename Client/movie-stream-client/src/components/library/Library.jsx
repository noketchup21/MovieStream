import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Movies from "../movies/Movies.jsx";
import useAuth from "../../hook/useAuth";
import { getLibraryMovies } from "../../utils/libraryStorage";

const Library = () => {
  const { auth } = useAuth();
  const [libraryMovies, setLibraryMovies] = useState([]);

  useEffect(() => {
    if (!auth?.user_id) {
      setLibraryMovies([]);
      return;
    }

    const loadLibrary = () => {
      const items = getLibraryMovies(auth.user_id);
      setLibraryMovies(items);
    };

    loadLibrary();
    window.addEventListener("library-updated", loadLibrary);

    return () => {
      window.removeEventListener("library-updated", loadLibrary);
    };
  }, [auth?.user_id]);

  return (
    <section className="container mt-4 mb-5">
      <div className="library-shell p-4 p-md-5">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h2 className="mb-1">Your Library</h2>
            <p className="text-muted mb-0">
              Saved titles for quick access from your profile menu.
            </p>
          </div>
          <Link to="/browse" className="btn btn-outline-light">
            Browse More
          </Link>
        </div>

        <Movies
          movies={libraryMovies}
          message="You have no saved movies yet. Open any title and click Save to Library."
          currentPage={1}
          totalPages={1}
          total={libraryMovies.length}
          showPagination={false}
        />
      </div>
    </section>
  );
};

export default Library;
