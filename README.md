# Campus Köthen – News & Events Website

Statische Website, die **alle** Neuigkeiten und Veranstaltungen der [Campus-Köthen-App](https://campus-koethen.sturahsa.de/) anzeigt – unabhängig von Datum und Kanal. Besucher*innen können selbst nach Kanal, Art (News/Event) und Suchbegriff filtern. Deutsch und Englisch, Hell- und Dunkelmodus.

- **Neuigkeiten:** alle Beiträge, neueste zuerst, Filter nach Kanal und Art, Volltextsuche
- **Veranstaltungen:** alle Event-Beiträge **und die Termine der öffentlichen Google-Kalender** (wie in der App) – kommende (aufsteigend) und vergangene (absteigend), mit „Heute/Morgen/Läuft gerade“-Hinweisen und `.ics`-Download. Kalender, die zu einem Kanal gehören, werden unter diesem Kanal gefiltert; Kalender ohne Kanal (z. B. Mensakeller) bekommen einen eigenen Filter. Termine, die zugleich als Event-Beitrag existieren (gleicher Start und gleicher Kanal), erscheinen nur einmal.
- Teilbare Ansichten (`?tab=events&channels=fsr-ins&q=…`) und Direktlinks auf Beiträge (`#post-<slug>`)
- Impressum & Datenschutzerklärung unter `/rechtliches/`
- Keine Cookies, kein Tracking, keine externen Ressourcen (Schrift und Logo werden selbst ausgeliefert)

## Architektur

```
Browser ──► nginx (Container, Port 8080)
              ├─ /            statische Dateien aus public/
              └─ /api/v1/…    Read-only-Proxy ──► API_BASE_URL (Campus-Köthen-API)
```

Die Campus-API erlaubt keine Cross-Origin-Aufrufe aus dem Browser (CORS). Deshalb leitet nginx eine feste Liste von Endpunkten (`/v1/posts`, `/v1/posts/channels`, `/v1/posts/tags`, `/v1/posts/{slug}`, `/v1/calendars`, `/v1/calendars/events`, `/v1/media/uploads/{datei}`, `/v1/environment`) an die API weiter. Nebeneffekte:

- IP-Adresse, Cookies, Referrer und User-Agent der Besucher*innen werden **nicht** an die API weitergegeben.
- Es wird **nichts gecacht** – weder auf dem Server noch im Browser (`Cache-Control: no-store`). Jede Anfrage geht live an die API, Website und App zeigen damit immer exakt dieselben Inhalte. Ist die API nicht erreichbar, zeigt die Website einen Fehlerhinweis mit „Erneut versuchen“.
- Zugriffsprotokolle speichern nur gekürzte IP-Adressen, Docker rotiert sie (5 × 10 MB).

Es werden **alle** Kalendertermine geladen, die die API liefert. Da die API pro Anfrage nur einen begrenzten Zeitraum erlaubt (aktuell 390 Tage), fragt die Website ausgehend von heute Zeitfenster für Zeitfenster in die Vergangenheit und in die Zukunft ab, bis zwei Fenster hintereinander leer sind. Die Fenstergröße übernimmt sie automatisch aus der API.

Die API-Adresse wird über die Umgebungsvariable `API_BASE_URL` gesetzt (Origin ohne Pfad und ohne abschließenden Slash).

## Betrieb mit Docker Compose

Auf dem Server (z. B. Hostinger-VPS):

```bash
mkdir campus-koethen-news && cd campus-koethen-news
curl -O https://raw.githubusercontent.com/Leviora-Studio/campus-app-news-feed-website/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Leviora-Studio/campus-app-news-feed-website/main/.env.example
# .env anpassen (API_BASE_URL, IMAGE_TAG, HOST_PORT)
docker compose pull
docker compose up -d
```

Die Website ist danach unter `http://127.0.0.1:8080` erreichbar. Domain und HTTPS übernimmt der vorhandene Reverse Proxy, z. B. nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

oder Caddy: `news.example.de { reverse_proxy 127.0.0.1:8080 }`

**Update:** `docker compose pull && docker compose up -d`
**Health-Check:** `curl http://127.0.0.1:8080/healthz`

### Konfiguration (`.env`)

| Variable       | Standard                                   | Bedeutung                                     |
|----------------|--------------------------------------------|-----------------------------------------------|
| `API_BASE_URL` | `https://campus-koethen-api.sturahsa.de`   | Origin der Campus-Köthen-API                  |
| `IMAGE_TAG`    | `latest`                                   | Image-Version (`1.2.3`, `1.2`, `1`, `latest`, `main`) |
| `BIND_ADDRESS` | `127.0.0.1`                                | Host-Adresse, an die der Port gebunden wird   |
| `HOST_PORT`    | `8080`                                     | Port auf dem Host                             |

## Images & Versionen (GitHub Actions)

Der Workflow `.github/workflows/docker-publish.yml` baut Multi-Arch-Images (amd64 + arm64) und veröffentlicht sie in der GitHub Container Registry:

| Ereignis                         | Image-Tags                                              |
|----------------------------------|---------------------------------------------------------|
| Git-Tag `v1.2.3` pushen          | `1.2.3`, `1.2`, `1`, `latest`                           |
| Push auf `main`                  | `main`, `sha-<commit>`                                  |
| Pull Request                     | nur Build-Test, kein Push                               |

Neues Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Image: `ghcr.io/leviora-studio/campus-app-news-feed-website`
Repository: https://github.com/Leviora-Studio/campus-app-news-feed-website

> Beim allerersten Push prüfen, ob das Paket unter *GitHub → Leviora-Studio → Packages → campus-app-news-feed-website → Package settings* auf **Public** steht, damit es ohne Login gepullt werden kann.

## Lokal entwickeln

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
open http://127.0.0.1:8080
```

Die Dateien in `public/` sind reines HTML/CSS/JavaScript ohne Build-Schritt. Der Platzhalter `__APP_VERSION__` wird beim Image-Build durch die Version ersetzt.

## Projektstruktur

```
public/                    statische Website
  index.html               News & Events
  rechtliches/index.html   Impressum & Datenschutz (DE/EN)
  assets/css/styles.css    Design (Farben der Campus-Köthen-App)
  assets/js/i18n.js        Texte DE/EN, Sprachumschaltung
  assets/js/app.js         Laden, Filtern, Darstellen
  assets/fonts/            Albert Sans (SIL OFL 1.1)
  assets/img/              Logo & Icons
nginx/                     nginx-Konfiguration (Templates mit ${API_BASE_URL})
Dockerfile
docker-compose.yml
.env.example
.github/workflows/docker-publish.yml
```

## Lizenz

Copyright © 2026 Erik Engler, handelnd unter „Leviora Studio“.

Der Quellcode steht unter der **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`), siehe [`LICENSE`](LICENSE). Wer die Website verändert und öffentlich betreibt, muss den Besucher*innen den geänderten Quellcode zugänglich machen (§ 13 AGPL) – die Website verlinkt dafür im Footer auf dieses Repository.

Ausgenommen von der AGPL:

- Schriftart „Albert Sans“: SIL Open Font License 1.1 (`public/assets/fonts/AlbertSans-OFL.txt`)
- Name und Logo „Campus Köthen“: Erik Engler, handelnd unter „Leviora Studio“
