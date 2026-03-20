import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import { useNavigate, NavLink, Link } from "react-router-dom";
import useAuth from "../../hook/useAuth";
import logo from "../../assets/logo.png";

const Header = ({ handleLogout }) => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const isAdmin =
    String(auth?.role || "")
      .trim()
      .toUpperCase() === "ADMIN";

  // const handleLogout = () => {
  //   localStorage.removeItem("user");
  //   navigate("/login");
  //   window.location.reload();
  // };

  return (
    <Navbar className="top-nav shadow-sm" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <img
            alt="MovieStream Logo"
            src={logo}
            width="56"
            height="56"
            className="brand-logo d-inline-block align-top me-2"
          />
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar-nav" />
        <Navbar.Collapse>
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/">
              Home
            </Nav.Link>
            <Nav.Link as={NavLink} to="/browse">
              Browse
            </Nav.Link>
            <Nav.Link as={NavLink} to="/recommend">
              Recommendations
            </Nav.Link>
            {isAdmin && (
              <>
                <Nav.Link as={NavLink} to="/admin/add-movie">
                  Add Movie
                </Nav.Link>
                <Nav.Link as={NavLink} to="/admin/edit-movies">
                  Edit Movies
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="ms-auto align-items-center">
            {auth ? (
              <NavDropdown
                align="end"
                id="user-menu-dropdown"
                className="user-menu-dropdown"
                title={
                  <span className="user-menu-toggle">
                    <i className="bi bi-person-circle me-2"></i>
                    <span className="user-menu-hello">Hello,</span>
                    <span className="user-menu-name ms-1">{auth.username}</span>
                    <i
                      className="bi bi-chevron-down user-menu-indicator ms-2"
                      aria-hidden="true"
                    ></i>
                  </span>
                }
              >
                <NavDropdown.Item onClick={() => navigate("/account")}>
                  My Profile
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={() => navigate("/login")}
                >
                  Login
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  className="ms-3"
                  onClick={() => navigate("/register")}
                >
                  Register
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};
export default Header;
