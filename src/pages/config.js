import React from 'react';
import { BackToPanelLink, PageShell, RequireAuth } from '../components/Layout';
import { SellasistConfigForm } from '../components/SellasistConfigForm';

function ConfigView() {
  return (
    <PageShell title="Konfiguracja Sellasist">
      <div className="space-y-6">
        <BackToPanelLink />
        <SellasistConfigForm />
      </div>
    </PageShell>
  );
}

export default function ConfigPage() {
  return (
    <RequireAuth>
      <ConfigView />
    </RequireAuth>
  );
}
