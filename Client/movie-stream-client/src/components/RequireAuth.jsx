import { useLocation, Navigate, Outlet } from "react-router-dom";
import useAuth from "../hook/useAuth";
import Loading from "./loading/Loading";

const RequireAuth = () => {
  const { auth, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <loading />;
  }

  if (!auth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
};
export default RequireAuth;
