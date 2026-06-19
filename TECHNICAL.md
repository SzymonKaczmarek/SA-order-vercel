## Dokumentacja techniczna – SA Order Reader

### Stos technologiczny

- **Gatsby 5** – generowanie statyczne, dev-server z hot-reloadem.
- **React 18** – komponenty funkcyjne, hooki.
- **Tailwind CSS 3.4** – utility-first CSS, kompilowane przez PostCSS.
- **localStorage** – sesja użytkownika + konfiguracja Sellasist (klient).
- **Netlify Functions** – proxy do [Sellasist REST API](https://api.sellasist.pl/) (omija CORS, ukrywa wywołania serwer-side).

### Cel aplikacji

1. Logowanie do panelu.
2. Po zalogowaniu:
   - **Konfiguracja** – subdomena konta Sellasist + klucz API.
   - **Zamówienia** – lista zamówień z `GET /orders`.

### Architektura

```
┌─────────────────────────────────────────────────────────┐
│  Gatsby (React) – warstwa prezentacji                   │
│  src/pages: index, config, orders                       │
│  src/hooks: useAuth, useSellasistConfig, useSellasistApi│
└───────────────────────┬─────────────────────────────────┘
                        │ fetch /.netlify/functions/*
┌───────────────────────▼─────────────────────────────────┐
│  Netlify Functions (Node)                               │
│  auth-login | sellasist-test | sellasist-orders         │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS + header apiKey
┌───────────────────────▼─────────────────────────────────┐
│  https://{account}.sellasist.pl/api/v1                    │
└─────────────────────────────────────────────────────────┘
```

#### Warstwa danych (localStorage)

| Klucz | Zawartość |
|-------|-----------|
| `saor_logged_user` | `{ username, role, firstName, lastName, email }` |
| `saor_sellasist_config` | `{ account, apiKey, useDemoData }` |

#### Tryb demo (dokumentacja API)

Dokumentacja [api.sellasist.pl](https://api.sellasist.pl/) definiuje serwer przykładowy `demo.sellasist.pl` oraz schematy OpenAPI z przykładowymi polami zamówień (`GET /orders`, `OrderResponse`).

W trybie demo (`useDemoData: true`):
- brak wywołań do API Sellasist,
- zamówienia pochodzą z `src/data/sellasistDemo.js` (zgodne ze schematami OpenAPI),
- wystarczy kliknąć **„Użyj danych demo z dokumentacji”** w konfiguracji.

#### Sellasist API

- Base URL: `https://{account}.sellasist.pl/api/v1`
- Autoryzacja: nagłówek `apiKey` ([dokumentacja](https://api.sellasist.pl/))
- Zamówienia: `GET /orders` z parametrami `limit`, `offset`, `status_id`, `from_id`, `email`, `payment_status` itd.

### Uruchomienie lokalne

```bash
npm install
npm run dev:netlify
```

Aplikacja: `http://localhost:8888` (Netlify Dev proxy + Gatsby na :8000).

**Logowanie demo (fallback bez AUTH_USERS):** `admin` / `admin123`

**Konfiguracja Sellasist:** panel → Konfiguracja → subdomena + klucz API → Testuj połączenie.

> Uwaga: samo `npm run develop` (port 8000) **nie** uruchamia funkcji Netlify – wywołania Sellasist wtedy nie zadziałają.

### Deploy Netlify

1. Połącz repozytorium z Netlify.
2. Build: `npm run build`, publish: `public`, functions: `netlify/functions`.
3. Opcjonalnie ustaw `AUTH_USERS` (JSON) w zmiennych środowiskowych:

```json
[{"username":"admin","password":"twoje_haslo","role":"admin","firstName":"Admin","lastName":"User","email":"admin@example.com"}]
```

### Plan rozwoju (kolejne iteracje)

| Faza | Zakres |
|------|--------|
| **v0.1 (obecna)** | Logowanie, konfiguracja Sellasist, lista zamówień, proxy Netlify |
| **v0.2** | Filtry (status, email, data), paginacja, szczegóły zamówienia `GET /orders/{id}` |
| **v0.3** | Cache zamówień w localStorage / IndexedDB, auto-odświeżanie |
| **v0.4** | Wielu użytkowników przez Neon/PostgreSQL (wzorzec z Predyspozycje PBP) |
| **v0.5** | Eksport CSV, webhooki Sellasist, powiadomienia |

### Bezpieczeństwo (prod)

- Klucz API w localStorage to kompromis na MVP – w produkcji rozważ przechowywanie po stronie serwera (env / baza).
- Ustaw `AUTH_USERS` lub zewnętrzną bazę zamiast hardcodowanych haseł w `src/data/users.js`.
