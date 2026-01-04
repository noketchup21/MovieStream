import { useState } from "react";
import Container from "react-bootstrap/esm/Container";
import Button from "react-bootstrap/esm/Button";
import Form from "react-bootstrap/esm/Form";
import axiosClient from "../../api/axiosConfig";
import { useNavigate, Link } from "react-router-dom";
import logo from "../../assets/logo.png";

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Step 1: Send verification code to email
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axiosClient.post("/resetpassword-send-code", {
        email: email,
      });
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setSuccess("Verification code sent to your email.");
        setStep(2);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to send verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axiosClient.post("/resetpassword-verify-code", {
        email: email,
        code: code,
      });
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResetToken(response.data.reset_token);
        setSuccess("Code verified! Enter your new password.");
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 5) {
      setError("Password must be at least 5 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await axiosClient.post("/resetpassword", {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setSuccess("Password reset successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axiosClient.post("/resetpassword-send-code", {
        email: email,
      });
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setSuccess("New verification code sent to your email.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="login-container d-flex align-items-center justify-content-center min-vh-100">
      <div
        className="login-card shadow p-4 rounded bg-white"
        style={{ maxWidth: 400, width: "100%" }}
      >
        <div className="text-center mb-4">
          <img src={logo} alt="Logo" width={60} height={60} className="mb-2" />
          <h2 className="fw-bold">Reset Password</h2>
          <p className="text-muted">
            {step === 1 && "Enter your email to receive a verification code."}
            {step === 2 && "Enter the verification code sent to your email."}
            {step === 3 && "Create a new password for your account."}
          </p>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        {/* Step 1: Email Form */}
        {step === 1 && (
          <Form onSubmit={handleSendCode}>
            <Form.Group className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100 mb-2"
              disabled={loading}
              style={{ fontWeight: 600, letterSpacing: 1 }}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Sending...
                </>
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </Form>
        )}

        {/* Step 2: Verification Code Form */}
        {step === 2 && (
          <Form onSubmit={handleVerifyCode}>
            <Form.Group className="mb-3">
              <Form.Label>Verification Code</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter 10-character code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                maxLength={10}
                style={{
                  letterSpacing: "0.2em",
                  textAlign: "center",
                  fontSize: "1.1em",
                  fontFamily: "monospace",
                }}
              />
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100 mb-2"
              disabled={loading}
              style={{ fontWeight: 600, letterSpacing: 1 }}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="btn btn-link text-muted"
                onClick={handleResendCode}
                disabled={loading}
              >
                Resend Code
              </button>
            </div>
          </Form>
        )}

        {/* Step 3: New Password Form */}
        {step === 3 && (
          <Form onSubmit={handleResetPassword}>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                isInvalid={!!confirmPassword && newPassword !== confirmPassword}
              />
              <Form.Control.Feedback type="invalid">
                Passwords do not match.
              </Form.Control.Feedback>
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100 mb-2"
              disabled={loading}
              style={{ fontWeight: 600, letterSpacing: 1 }}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </Form>
        )}

        <div className="text-center mt-3">
          <Link to="/login" className="fw-semibold">
            ← Back to Login
          </Link>
        </div>
      </div>
    </Container>
  );
};

export default ForgotPassword;
