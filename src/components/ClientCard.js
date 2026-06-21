import React from 'react';
import {
  formatDate,
  getClientAddressLine,
  getClientEmail,
  getClientFullName,
  getClientImportedAt,
  getClientPhone,
} from '../utils/clientFormat';
import { getClientKey } from '../utils/clientSelection';
import { IconTrash } from './Icons';

function MetaChip({ label, value, title }) {
  if (!value || value === '—') {
    return null;
  }

  return (
    <span
      title={title || `${label}: ${value}`}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 max-w-full min-w-0"
    >
      <span className="text-slate-400 font-semibold uppercase tracking-wide shrink-0">{label}</span>
      <span className="truncate text-slate-700">{value}</span>
    </span>
  );
}

export function ClientCard({ client, onDelete }) {
  const clientKey = getClientKey(client);
  const email = getClientEmail(client);
  const phone = getClientPhone(client);
  const address = getClientAddressLine(client);
  const nip = client.company_nip || client.nip || '';
  const fullName = getClientFullName(client);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 shrink-0">
              #{clientKey || '—'}
            </span>
            <h3 className="text-sm font-semibold text-slate-900 truncate">{fullName}</h3>
            {client.company_name && client.company_name !== fullName && (
              <span className="text-xs text-slate-500 truncate">· {client.company_name}</span>
            )}
          </div>

          <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 min-w-0">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="block text-sm font-semibold text-sky-900 break-all hover:text-brand-primary"
              >
                {email}
              </a>
            ) : (
              <span className="block text-sm text-slate-400">Brak e-mail</span>
            )}
            {address ? (
              <p className="mt-1 text-xs text-slate-600 leading-snug">{address}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Brak adresu</p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetaChip label="Tel" value={phone} />
            <MetaChip label="Miasto" value={client.city} />
            <MetaChip label="NIP" value={nip} />
            <MetaChip
              label="Pobrano"
              value={formatDate(getClientImportedAt(client))}
              title="Data importu z API Sellasist"
            />
          </div>
        </div>

        {onDelete && clientKey && (
          <button
            type="button"
            onClick={() => onDelete([clientKey])}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 shrink-0"
          >
            <IconTrash className="w-3 h-3" />
            Usuń
          </button>
        )}
      </div>
    </article>
  );
}
