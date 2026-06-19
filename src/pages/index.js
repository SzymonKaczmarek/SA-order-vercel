import React from 'react';
import { Link } from 'gatsby';
import { Dashboard } from '../components/Dashboard';
import { LoginPage } from '../components/LoginPage';
import { useAuth } from '../context/AuthContext';

export default function IndexPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-slate-500 text-sm">
        Ładowanie…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
