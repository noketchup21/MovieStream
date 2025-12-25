
// const Register = () => {
//     return (
//         <h2>Register</h2>
//     )
// }
// export default Register;

import { useState } from "react";
import "./Register.css";

const Register = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(form);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Create Account</h2>
        <p className="subtitle">Join MovieHub today 🎬</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          <button type="submit">Register</button>
        </form>

        <p className="login-link">
          Already have an account? <span>Login</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
