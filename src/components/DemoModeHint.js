import React from 'react';
import { DEMO_ORDERS, SELLASIST_DOCS_URL } from '../data/sellasistDemo';

export function DemoModeHint() {
  return (
    <p className="text-xs text-slate-400 italic text-right ml-auto max-w-xl leading-relaxed">
      Tryb demo – dane ze schematów OpenAPI{' '}
      <a
        href={SELLASIST_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-500 underline underline-offset-2 hover:text-slate-600 not-italic"
      >
        api.sellasist.pl
      </a>
      {` (${DEMO_ORDERS.length} rekordów).`}
    </p>
  );
}
