import React, { useEffect, useRef } from "react";
import "./Modal.css";

export default function LoginModal({ open, onClose, loginForm, setLoginForm, onLogin }) {
  const usernameRef = useRef(null);

  useEffect(() => {
    if (open && usernameRef.current) {
      usernameRef.current.focus(); // Autofocus on username input
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Login</h3>

        <input
          ref={usernameRef}
          placeholder="Username (e.g. user or user@swd.bh)"
          value={loginForm.username}
          onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
        />
        <input
          type="password"
          placeholder="Password"
          value={loginForm.password}
          onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
        />

        <div className="modal-actions">
          <button className="login-btn" onClick={onLogin}>Login</button>
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
