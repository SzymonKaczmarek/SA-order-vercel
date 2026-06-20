# Dokumentacja techniczna – SA Order Reader

**Produkcja:** https://sa-orders.netlify.app  
**Panel Netlify:** https://app.netlify.com/projects/sa-orders  
**Baza danych:** https://app.netlify.com/projects/sa-orders/database  
**Site ID:** `f5caa14d-1b2a-4bf3-9885-04959695e506`

---

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Gatsby 5, React 18, Tailwind CSS 3.4 |
| Hosting | Netlify (SSG + Functions) |
| Baza | Netlify Database (PostgreSQL / Neon) |
| API zewnętrzne | Sellasist REST API (`https://{konto}.sellasist.pl/api/v1`) |
| Dane lokalne | `localStorage` (sesja, konta, config, cache zamówień) |

---

## Architektura

```
┌──────────────────────────────────────────────────────────────────┐
│  Gatsby (React) – panel www                                      │
│  /  /accounts  /config  /orders  /logs                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ fetch /.netlify/functions/*
┌────────────────────────────▼─────────────────────────────────────┐
│  Netlify Functions                                               │
│  auth-login │ sellasist-test │ sellasist-orders │ app-db         │
└────────────┬───────────────────────────────┬───────────────────────┘
             │ HTTPS + apiKey                │ @netlify/database
┌────────────▼──────────────┐   ┌──────────▼──────────────────────┐
│  Sellasist API             │   │  PostgreSQL (Netlify Database)    │
│  {account}.sellasist.pl    │   │  tabela: app_kv_store             │
└────────────────────────────┘   └───────────────────────────────────┘
```

---

## Moduły aplikacji

### Konta (`/accounts`)

- Każde konto ma **nazwę**, **login** i **hasło** do panelu.
- Login konta = dane logowania do aplikacji.
- Izolacja danych: osobna konfiguracja Sellasist i bazy zamówień per konto.
- CRUD: tworzenie, edycja, usuwanie (min. 1 konto musi zostać).

### Konfiguracja Sellasist (`/config` lub modal na `/orders`)

- Pola: subdomena konta, klucz API, tryb demo.
- Zapis: `localStorage` + synchronizacja na serwer (`app-db` → `config:{accessAccountId}`).

### Zamówienia (`/orders`)

Trzy źródła danych:

| Źródło | Opis | Trwałość |
|--------|------|----------|
| **Baza danych (serwer)** | Netlify Database | Po odświeżeniu / między urządzeniami |
| **Baza lokalna** | localStorage | Tylko ta przeglądarka |
| **Bufor** | Pamięć sesji | Znika po zamknięciu karty (chyba że zapiszesz) |

Funkcje: import z API (wszystkie / ostatnie X / zakres ID), paginacja, filtry, eksport CSV, zarządzanie przenoszeniem między źródłami.

### Dziennik zdarzeń (`/logs`)

- Rejestruje: logowania, konta, config, zamówienia, zapytania API, operacje DB, błędy.
- Hasła i klucze API są maskowane (`[ukryte]`).
- Zapis: localStorage (300 wpisów) + serwer (500 wpisów, klucz `event_log:global`).
- **Wyczyść log** – wymaga loginu/hasła domyślnego administratora (`DEFAULT_USER` w `src/data/users.js`), weryfikacja też po stronie `app-db`.

---

## Netlify Functions

| Funkcja | Plik | Opis |
|---------|------|------|
| `auth-login` | `auth-login.js` | Logowanie: `AUTH_USERS` (env) lub konta z bazy |
| `sellasist-test` | `sellasist-test.js` | Test połączenia z API Sellasist |
| `sellasist-orders` | `sellasist-orders.js` | Proxy `GET /orders` (paczki, timeout 26s) |
| `app-db` | `app-db.js` | CRUD danych aplikacji w PostgreSQL |

### API `app-db` (POST, JSON)

| `action` | Opis |
|----------|------|
| `get_access` / `set_access` | Konta aplikacji (login, hasło, nazwa) |
| `get_config` / `set_config` | Konfiguracja Sellasist per konto |
| `get_orders` / `set_orders` / `clear_orders` | Zamówienia per scope |
| `get_event_logs` / `append_event_log` / `clear_event_logs` | Dziennik zdarzeń |

`clear_event_logs` wymaga `adminUsername` + `adminPassword` (domyślne konto admin).

---

## Baza danych (Netlify Database)

### Schemat

Tabela KV (migracja: `netlify/database/migrations/00001_app_kv_store.sql`):

```sql
app_kv_store (
  scope_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

### Klucze `scope_key`

| Klucz | Zawartość |
|-------|-----------|
| `access:store` | `{ accounts[], activeId, users{} }` |
| `config:{accessAccountId}` | `{ account, apiKey, useDemoData }` |
| `orders:{accessAccountId}::{sellasistScope}` | `{ orders[], fetchedAt, meta, ... }` |
| `event_log:global` | `{ entries[] }` |

Funkcja `app-db` tworzy tabelę automatycznie (`CREATE TABLE IF NOT EXISTS`) jako fallback; migracje Netlify są preferowanym sposobem na produkcji.

### Komendy operacyjne

```bash
# Status bazy (lokalnie / po linku do projektu)
npx netlify database status

# Zastosuj migracje lokalnie
npx netlify database migrations apply

# Zapytanie SQL
npx netlify database connect --query "SELECT scope_key, updated_at FROM app_kv_store ORDER BY updated_at DESC LIMIT 20"

# Interaktywny klient
npx netlify database connect
```

---

## localStorage (klient)

| Klucz | Zawartość |
|-------|-----------|
| `saor_logged_user` | Sesja zalogowanego użytkownika |
| `saor_access_accounts` | Lista kont + aktywne ID |
| `saor_sellasist_config` | Config Sellasist mapowany per `accessAccountId` |
| `saor_orders_cache` | Cache zamówień lokalnych |
| `saor_event_log` | Lokalna kopia dziennika |

---

## Uruchomienie lokalne

```bash
npm install
npm run dev:netlify
```

- **URL:** http://localhost:8888 (nie 8000 – port 8000 to sam Gatsby bez funkcji)
- **Baza lokalna:** Netlify Dev uruchamia instancję Postgres (extension `neon`)
- **Fallback:** gdy brak DB, `app-db` używa pamięci procesu (tylko na czas sesji dev)

### Domyślne konto administratora

Zdefiniowane w `src/data/users.js` (`DEFAULT_USER`). Używane przy pierwszym starcie i do czyszczenia logu.

---

## Deploy na produkcję

### 1. Push do GitHub (`main`)

Netlify buduje z brancha `main`.

```bash
git push origin main
```

### 2. Deploy ręczny (opcjonalnie, z lokalnych zmian)

```bash
npx netlify link --id f5caa14d-1b2a-4bf3-9885-04959695e506
npx netlify deploy --prod --build
```

Deploy z `--build` uruchamia migracje bazy i bundluje funkcje z `@netlify/database`.

### 3. Zmienne środowiskowe (Netlify → Site settings → Environment)

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `AUTH_USERS` | Opcjonalna | JSON użytkowników legacy; konta z panelu mają pierwszeństwo w DB |
| `NETLIFY_DB_URL` | Auto | Ustawiana przez extension Netlify Database |

Przykład `AUTH_USERS`:

```json
[{"username":"admin","password":"***","role":"admin","firstName":"Admin","lastName":"User","email":"admin@example.com"}]
```

### 4. Weryfikacja po deploy

```bash
curl -s -X POST https://sa-orders.netlify.app/.netlify/functions/app-db \
  -H 'Content-Type: application/json' \
  -d '{"action":"get_event_logs"}'
```

Oczekiwane: `{"ok":true,"data":{"entries":[...]}}`

---

## Struktura katalogów

```
netlify/
  functions/          # Serverless API
  database/migrations/  # Migracje PostgreSQL
src/
  pages/              # Trasy Gatsby
  components/         # UI
  context/            # Auth, konta
  hooks/              # API, config
  data/               # Modele lokalne, demo
  utils/              # Import, filtry, eventLog
```

---

## Bezpieczeństwo (uwagi produkcyjne)

- Hasła kont i klucze API są przechowywane w plain text (localStorage + JSONB) – akceptowalne na MVP wewnętrzne; na produkcji zewnętrznej rozważ hash haseł i szyfrowanie kluczy API.
- `clear_event_logs` chronione hasłem admina (klient + serwer).
- Klucz Sellasist nigdy nie trafia do logów zdarzeń w jawnej postaci.
- Timeout funkcji Sellasist: 26s (limit planu Netlify).

---

## Changelog (ostatnie wdrożenie)

- Netlify Database (`app-db`) – konta, config, zamówienia, logi
- Konta z loginem/hasłem, edycja i usuwanie
- Trzy magazyny zamówień (serwer / local / bufor)
- Import: wszystkie / ostatnie X / zakres ID
- Paginacja z numerami stron
- Dziennik zdarzeń (`/logs`) z filtrowaniem
- Czyszczenie logu z autoryzacją admina
