import { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import axiosClient from "../../api/axiosConfig";
import useAxiosPrivate from "../../hook/useAxiosPrivate";
import useAuth from "../../hook/useAuth";
import Loading from "../loading/Loading.jsx";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const Account = () => {
  const axiosPrivate = useAxiosPrivate();
  const { setAuth } = useAuth();

  const [profile, setProfile] = useState(null);
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [twoFAWorking, setTwoFAWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [twoFAQrUrl, setTwoFAQrUrl] = useState("");
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const selectedGenreIds = useMemo(
    () => new Set(selectedGenres.map((g) => g.genre_id)),
    [selectedGenres],
  );

  const twoFAImageUrl = useMemo(() => {
    if (!twoFAQrUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(twoFAQrUrl)}`;
  }, [twoFAQrUrl]);

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      setError("");

      try {
        const [profileResponse, genresResponse] = await Promise.all([
          axiosPrivate.get("/profile"),
          axiosClient.get("/genres"),
        ]);

        const profileData = profileResponse.data;
        const safeGenres = Array.isArray(profileData.favorite_genres)
          ? profileData.favorite_genres
          : [];

        setProfile(profileData);
        setUsername(profileData.username || "");
        setSelectedGenres(safeGenres);
        setGenres(
          Array.isArray(genresResponse.data) ? genresResponse.data : [],
        );
      } catch (err) {
        console.error("Failed to load account details", err);
        setError(
          err.response?.data?.error ||
            "Unable to load account details. Please refresh and try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, []);

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) => {
      const exists = prev.some((g) => g.genre_id === genre.genre_id);
      if (exists) {
        return prev.filter((g) => g.genre_id !== genre.genre_id);
      }

      return [
        ...prev,
        {
          genre_id: genre.genre_id,
          genre_name: genre.genre_name,
        },
      ];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    const wantsPasswordChange =
      currentPassword || newPassword || confirmPassword;

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError("Fill all password fields to update password.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("New password and confirm password do not match.");
        return;
      }

      if (newPassword.length < 5) {
        setError("New password must be at least 5 characters.");
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        username: trimmedUsername,
        favorite_genres: selectedGenres,
      };

      if (wantsPasswordChange) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.confirm_password = confirmPassword;
      }

      const response = await axiosPrivate.patch("/profile", payload);
      const updatedProfile = response?.data?.profile;

      if (!updatedProfile) {
        throw new Error("Profile update response is missing profile data");
      }

      setProfile(updatedProfile);
      setUsername(updatedProfile.username || "");
      setSelectedGenres(
        Array.isArray(updatedProfile.favorite_genres)
          ? updatedProfile.favorite_genres
          : [],
      );

      setAuth((prev) => ({
        ...(prev || {}),
        username: updatedProfile.username,
        email: updatedProfile.email,
        role: updatedProfile.role,
        favorite_genres: updatedProfile.favorite_genres,
      }));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(response?.data?.message || "Account updated successfully.");
    } catch (err) {
      console.error("Failed to update account", err);
      setError(
        err.response?.data?.error ||
          "Unable to update account details. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetupTwoFA = async () => {
    setMessage("");
    setError("");
    setTwoFAWorking(true);

    try {
      const response = await axiosPrivate.post("/profile/2fa/setup");
      setTwoFAQrUrl(response?.data?.qr_url || "");
      setTwoFASecret(response?.data?.secret || "");
      setTwoFACode("");
      setMessage(
        "Scan the QR code and enter a 6-digit code to finish enabling 2FA.",
      );
    } catch (err) {
      console.error("Failed to start 2FA setup", err);
      setError(err.response?.data?.error || "Unable to start 2FA setup.");
    } finally {
      setTwoFAWorking(false);
    }
  };

  const handleConfirmTwoFA = async () => {
    const code = twoFACode.trim();
    if (code.length !== 6) {
      setError("Enter a valid 6-digit code.");
      return;
    }

    setMessage("");
    setError("");
    setTwoFAWorking(true);

    try {
      const response = await axiosPrivate.post("/profile/2fa/confirm", {
        code,
      });

      setProfile((prev) => ({ ...(prev || {}), two_fa_enabled: true }));
      setTwoFAQrUrl("");
      setTwoFASecret("");
      setTwoFACode("");
      setMessage(response?.data?.message || "2FA enabled successfully.");
    } catch (err) {
      console.error("Failed to confirm 2FA", err);
      setError(err.response?.data?.error || "Unable to confirm 2FA.");
    } finally {
      setTwoFAWorking(false);
    }
  };

  const handleDisableTwoFA = async () => {
    const code = disableCode.trim();
    if (code.length !== 6) {
      setError("Enter your current 6-digit authenticator code to disable 2FA.");
      return;
    }

    setMessage("");
    setError("");
    setTwoFAWorking(true);

    try {
      const response = await axiosPrivate.post("/profile/2fa/disable", {
        code,
      });
      setProfile((prev) => ({ ...(prev || {}), two_fa_enabled: false }));
      setDisableCode("");
      setTwoFAQrUrl("");
      setTwoFASecret("");
      setMessage(response?.data?.message || "2FA disabled successfully.");
    } catch (err) {
      console.error("Failed to disable 2FA", err);
      setError(err.response?.data?.error || "Unable to disable 2FA.");
    } finally {
      setTwoFAWorking(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <section className="container mt-4 pb-5">
      <div className="account-shell glass-panel p-4 p-lg-5">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
          <div>
            <p className="account-kicker mb-2">Your Profile</p>
            <h2 className="mb-1">Account Details</h2>
            <p className="text-muted mb-0">
              Manage your profile information and personal preferences.
            </p>
          </div>
        </div>

        {message && <div className="alert alert-success py-2">{message}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="account-info-card h-100">
              <h5 className="mb-3">Profile Snapshot</h5>
              <p className="mb-2">
                <span className="account-meta-label">Email:</span>{" "}
                {profile?.email}
              </p>
              <p className="mb-2">
                <span className="account-meta-label">Role:</span>{" "}
                {profile?.role}
              </p>
              <p className="mb-2">
                <span className="account-meta-label">Verified:</span>{" "}
                {profile?.is_validated ? "Yes" : "No"}
              </p>
              <p className="mb-2">
                <span className="account-meta-label">2FA:</span>{" "}
                {profile?.two_fa_enabled ? "Enabled" : "Disabled"}
              </p>
              <p className="mb-2">
                <span className="account-meta-label">Created:</span>{" "}
                {formatDate(profile?.created_at)}
              </p>
              <p className="mb-0">
                <span className="account-meta-label">Last Update:</span>{" "}
                {formatDate(profile?.updated_at)}
              </p>
            </div>
          </div>

          <div className="col-lg-7">
            <Form onSubmit={handleSubmit} className="account-form-card">
              <h5 className="mb-3">Edit Account</h5>

              <Form.Group className="mb-3" controlId="accountUsername">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="accountEmailReadonly">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={profile?.email || ""}
                  readOnly
                />
                <Form.Text className="text-muted">
                  Email updates are currently disabled for security reasons.
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-4" controlId="accountFavoriteGenres">
                <Form.Label>Favorite Genres</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {genres.map((genre) => {
                    const selected = selectedGenreIds.has(genre.genre_id);
                    return (
                      <button
                        key={genre.genre_id}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={
                          selected ? "genre-chip active" : "genre-chip"
                        }
                      >
                        {genre.genre_name}
                      </button>
                    );
                  })}
                </div>
              </Form.Group>

              <h6 className="account-section-title">Change Password</h6>
              <div className="row g-3">
                <div className="col-12">
                  <Form.Control
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Control
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <Form.Control
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 d-flex justify-content-end">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>

              <hr className="my-4" />

              <h6 className="account-section-title mb-2">
                Two-Factor Authentication (2FA)
              </h6>
              <p className="text-muted mb-3">
                Add an extra sign-in step using a 6-digit code from your
                authenticator app.
              </p>

              {!profile?.two_fa_enabled && (
                <div className="twofa-panel">
                  {!twoFAQrUrl ? (
                    <Button
                      variant="outline-info"
                      onClick={handleSetupTwoFA}
                      disabled={twoFAWorking}
                    >
                      {twoFAWorking ? "Preparing..." : "Enable 2FA"}
                    </Button>
                  ) : (
                    <>
                      <div className="twofa-qr-wrap mb-3">
                        <img
                          src={twoFAImageUrl}
                          alt="2FA QR code"
                          className="twofa-qr-image"
                        />
                        <div className="twofa-secret-box">
                          <small className="text-muted d-block mb-1">
                            Manual setup key
                          </small>
                          <code>{twoFASecret}</code>
                        </div>
                      </div>

                      <Form.Group className="mb-2" controlId="twoFACode">
                        <Form.Label>Enter 6-digit code</Form.Label>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          className="twofa-code-input"
                          value={twoFACode}
                          onChange={(e) =>
                            setTwoFACode(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="123456"
                        />
                      </Form.Group>

                      <div className="d-flex gap-2 flex-wrap">
                        <Button
                          variant="success"
                          onClick={handleConfirmTwoFA}
                          disabled={twoFAWorking}
                        >
                          {twoFAWorking ? "Verifying..." : "Confirm and Enable"}
                        </Button>
                        <Button
                          variant="outline-secondary"
                          onClick={() => {
                            setTwoFAQrUrl("");
                            setTwoFASecret("");
                            setTwoFACode("");
                          }}
                          disabled={twoFAWorking}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {profile?.two_fa_enabled && (
                <div className="twofa-panel">
                  <Form.Group className="mb-3" controlId="disableTwoFACode">
                    <Form.Label>
                      Enter current 6-digit code to disable 2FA
                    </Form.Label>
                    <Form.Control
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="twofa-code-input"
                      value={disableCode}
                      onChange={(e) =>
                        setDisableCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="123456"
                    />
                  </Form.Group>
                  <Button
                    variant="outline-danger"
                    onClick={handleDisableTwoFA}
                    disabled={twoFAWorking}
                  >
                    {twoFAWorking ? "Disabling..." : "Disable 2FA"}
                  </Button>
                </div>
              )}
            </Form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
