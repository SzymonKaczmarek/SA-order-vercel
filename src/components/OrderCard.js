import React, { useState } from 'react';
import {
  formatAddress,
  formatDate,
  formatMoney,
  getCustomerFullName,
  getOrderCarts,
  getOrderPhone,
} from '../utils/orderFormat';
import { downloadOrdersCsv, getOrderExportFilename } from '../utils/exportOrdersCsv';
import { ButtonLabel } from './ButtonLabel';
import { IconCode, IconFileExport, IconTrash } from './Icons';
import { OrderStatusPill } from './OrderStatusPill';
import { getOrderKey } from '../utils/orderSelection';
import { JsonOverlay } from './JsonOverlay';

function AddressBlock({ title, address }) {
  const lines = formatAddress(address);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">
        {title}
      </h4>
      {lines ? (
        <div className="text-sm text-slate-700 space-y-0.5 whitespace-pre-line">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Brak danych</p>
      )}
    </div>
  );
}

function PhoneLink({ phone, onClickLink }) {
  if (!phone) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 w-full">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </span>
        <span className="text-xs text-slate-400">Brak telefonu</span>
      </div>
    );
  }

  return (
    <a
      href={`tel:${phone.replace(/\s/g, '')}`}
      onClick={onClickLink}
      className="group flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-brand-primary to-[#2d5280] px-3 py-2 w-full shadow-sm shadow-brand-primary/20 hover:shadow-md hover:shadow-brand-primary/25 transition-shadow"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[9px] uppercase tracking-[0.18em] font-semibold text-white/70">
          Telefon
        </span>
        <span className="block text-sm font-bold text-white tracking-wide truncate group-hover:text-white">
          {phone}
        </span>
      </span>
    </a>
  );
}

function EmailLink({ email, onClickLink }) {
  if (!email) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 w-full">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </span>
        <span className="text-xs text-slate-400">Brak e-mail</span>
      </div>
    );
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={onClickLink}
      title={email}
      className="group flex items-center gap-2.5 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white px-3 py-2 w-full hover:border-sky-200 hover:from-sky-100/80 hover:to-white transition-colors"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 group-hover:bg-sky-200/80 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[9px] uppercase tracking-[0.18em] font-semibold text-sky-600/70">
          E-mail
        </span>
        <span className="block text-xs font-semibold text-slate-700 truncate group-hover:text-brand-accent transition-colors">
          {email}
        </span>
      </span>
    </a>
  );
}

function OrderMetaPill({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ${className}`}
    >
      {children}
    </span>
  );
}

function HeaderContact({ phone, email, onClickLink }) {
  return (
    <div className="flex flex-col justify-center gap-2 w-full sm:w-[240px] shrink-0 rounded-2xl border border-slate-100 bg-white/60 p-2 shadow-sm">
      <PhoneLink phone={phone} onClickLink={onClickLink} />
      <EmailLink email={email} onClickLink={onClickLink} />
    </div>
  );
}

export function OrderCard({ order, selected, onSelectedChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const phone = getOrderPhone(order);
  const carts = getOrderCarts(order);
  const orderId = order.id || order.order_id;
  const orderKey = getOrderKey(order);

  const stopPropagation = (e) => e.stopPropagation();

  const handleExport = (e) => {
    e.stopPropagation();
    downloadOrdersCsv([order], getOrderExportFilename(order));
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(orderKey);
  };

  return (
    <article
      className={`rounded-3xl bg-white border overflow-hidden transition-colors ${
        selected ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-stretch min-h-[120px]">
        <label
          className="flex items-center px-4 border-r border-slate-100 bg-slate-50/50 cursor-pointer shrink-0"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
        >
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={(e) => onSelectedChange?.(orderKey, e.target.checked)}
            className="rounded border-slate-300 text-brand-primary focus:ring-brand-accent/30 w-4 h-4"
            aria-label={`Zaznacz zamówienie ${orderId}`}
          />
        </label>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex-1 px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/80 transition-colors min-w-0"
        >
        <svg
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>

        <div className="flex-1 min-w-0 grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                Zamówienie #{orderId}
              </p>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mt-1 truncate leading-tight">
              {getCustomerFullName(order)}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <OrderStatusPill order={order} />
              <OrderMetaPill>
                {formatDate(order.date || order.created_at || order.date_add)}
              </OrderMetaPill>
              <OrderMetaPill className="font-semibold text-slate-800 bg-white">
                {formatMoney(order.total, order.currency)}
              </OrderMetaPill>
            </div>
          </div>

          <HeaderContact phone={phone} email={order.email} onClickLink={stopPropagation} />
        </div>
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4 pt-4">
            <AddressBlock title="Adres do faktury (bill_address)" address={order.bill_address} />
            <AddressBlock title="Adres do wysyłki (shipment_address)" address={order.shipment_address} />
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">
              Produkty (carts)
            </h4>
            {carts.length === 0 ? (
              <p className="text-sm text-slate-400 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
                Brak pozycji koszyka w odpowiedzi API
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Produkt</th>
                      <th className="px-4 py-2.5">Ilość</th>
                      <th className="px-4 py-2.5">Cena</th>
                      <th className="px-4 py-2.5">EAN</th>
                      <th className="px-4 py-2.5">Symbol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carts.map((item, index) => (
                      <tr
                        key={item.id || item.product_id || index}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {item.name || '—'}
                          {item.product_id != null && (
                            <span className="block text-xs text-slate-400 font-normal">
                              ID: {item.product_id}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{item.quantity ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {formatMoney(item.price, order.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{item.ean || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {item.symbol || item.catalog_number || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100"
            >
              <ButtonLabel icon={IconTrash}>Usuń zamówienie</ButtonLabel>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <ButtonLabel icon={IconFileExport}>Eksportuj do CSV</ButtonLabel>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setJsonOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700"
            >
              <ButtonLabel icon={IconCode}>Pokaż JSON</ButtonLabel>
            </button>
          </div>
        </div>
      )}

      <JsonOverlay
        open={jsonOpen}
        title={`JSON zamówienia #${orderId}`}
        subtitle="GET /api/v1/orders_with_carts → rekord zamówienia"
        payload={order}
        onClose={() => setJsonOpen(false)}
      />
    </article>
  );
}
