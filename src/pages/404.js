import React from 'react';
import { Link } from 'gatsby';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold text-slate-900">404</h1>
        <p className="text-slate-600">Nie znaleziono strony.</p>
        <Link
          to="/"
          className="inline-flex rounded-2xl bg-brand-primary text-white px-5 py-2.5 text-sm font-semibold"
        >
          Strona główna
        </Link>
      </div>
    </div>
  );
}
