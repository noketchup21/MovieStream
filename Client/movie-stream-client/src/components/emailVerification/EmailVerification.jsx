import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Form, Button, Alert } from "react-bootstrap";
import axiosClient from "../../api/axiosConfig";
import "./EmailVerification.css";
import { Toast, ToastContainer } from "react-bootstrap";

const CODE_EXPIRY_MINUTES = 15;

const EmailVerification = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [toast, setToast] = useState({
    show: false,
    message: "",
    variant: "success", // success | danger | warning
  });

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
      setToast({
        show: true,
        message: "Email verified successfully!",
        variant: "success",
      });
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed");
      setToast({
        show: true,
        message: err.response?.data?.error || "Verification failed",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastContainer position="top-end" className="p-3">
        <Toast bg={toast.variant} show={toast.show} autohide delay={3000}>
          <Toast.Header closeButton={false}>
            <strong className="me-auto">
              {toast.variant === "success" ? "Success" : "Error"}
            </strong>
            <small>now</small>
          </Toast.Header>
          <Toast.Body className="text-white d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.2rem" }}>
              {toast.variant === "success" ? "✅" : "❌"}
            </span>
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <Container className="email-verify-container d-flex justify-content-center align-items-center">
        <div
          className={`email-verify-card ${
            expired ? "email-verify-expired" : ""
          }`}
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

            <Button
              type="submit"
              className="w-100"
              disabled={loading || expired}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
          </Form>
        </div>
      </Container>
    </>
  );
};

export default EmailVerification;
