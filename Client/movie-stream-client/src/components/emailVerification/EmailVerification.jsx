import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Form, Button, Alert } from "react-bootstrap";
import axiosClient from "../../api/axiosConfig";
import "./EmailVerification.css";

const CODE_EXPIRY_MINUTES = 15;

const EmailVerification = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    const timer = setTimeout(() => {
      setExpired(true);
    }, CODE_EXPIRY_MINUTES * 60 * 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (expired) {
      setError("Verification code has expired.");
      return;
    }

    // allow letters, numbers, and symbols (10 chars exactly)
    if (!/^[\x21-\x7E]{10}$/.test(code)) {
      setError("Code must be exactly 10 characters.");
      return;
    }

    try {
      setLoading(true);
      await axiosClient.post("/verify-email", { email, code });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="email-verify-container d-flex justify-content-center align-items-center">
      <div
        className={`email-verify-card ${expired ? "email-verify-expired" : ""}`}
      >
        <h3 className="text-center mb-3">Verify Email</h3>
        <p className="text-muted text-center">
          Enter the 10-character code sent to <strong>{email}</strong>
        </p>

        {error && <Alert variant="danger">{error}</Alert>}
        {expired && (
          <Alert variant="warning">
            Code expired. Please request a new one.
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Verification Code</Form.Label>
            <Form.Control
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={10}
              placeholder="Enter code"
              disabled={expired}
              required
            />
          </Form.Group>

          <Button type="submit" className="w-100" disabled={loading || expired}>
            {loading ? "Verifying..." : "Verify Email"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default EmailVerification;
