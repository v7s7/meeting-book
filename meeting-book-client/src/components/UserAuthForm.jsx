// components/UserAuthForm.jsx
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../utils/firebase';

function UserAuthForm({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="overlay">
      <div className="form-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <form onSubmit={handleSubmit}>
          <h3>{isNew ? 'Sign Up' : 'Log In'}</h3>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          <button type="submit">{isNew ? 'Create Account' : 'Login'}</button>
          <button type="button" onClick={() => setIsNew(!isNew)}>
            {isNew ? 'Have an account? Login' : 'New here? Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserAuthForm;
