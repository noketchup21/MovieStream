import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import {useNavigate, NavLink, Link} from "react-router-dom";
import { useState } from 'react';

const Header = () => {
    const navigate = useNavigate();
    const [auth, setAuth] = useState(false);

    return (
        <Navbar className="shadow-sm" bg="dark" variant="dark" expand="lg">
            <Container>
                <Navbar.Brand as={Link} to="/">
                    MovieStream
                </Navbar.Brand>

            <Navbar.Toggle aria-controls='main-navbar-nav' />
            <Navbar.Collapse>
                <Nav className='me-auto'>
                    <Nav.Link as={NavLink} to="/">
                        Home
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/recommend">
                        Recommendations
                    </Nav.Link>
                </Nav>

            <Nav className='ms-auto align-items-center'>
                {auth ? ( 
                <>
                    <span>
                        Hello, <strong>Guest</strong>
                    </span>
                    <Button variant='outline-light' size='sm' className='ms-3' onClick={() => navigate('/login')}>
                        Login
                    </Button>
                </>
                ):(
                    <>
                    <Button variant='outline-light' size='sm' onClick={() => navigate('/login')}>
                        Login
                    </Button>
                    <Button variant='light' size='sm' className='ms-3' onClick={() => navigate('/register')}>
                        Register
                    </Button>
                    </>
                )}
            </Nav>
            </Navbar.Collapse>
            </Container>
        </Navbar>
    )
}
export default Header;