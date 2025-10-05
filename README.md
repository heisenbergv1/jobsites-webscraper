
## What this repo does

This is an open-source set of scripts that lets us politely (and occasionally ruthlessly) hammer job posting sites with Puppeteer. We scrape listings from job sites, extract useful fields (company, title, location, description, etc.), write results to `jobs.csv`, and create records in an Airtable base via the Airtable API.

We also filter and normalize results based on configs we set (whitelists, blacklists, locations, and other tasty rules). Soon we'll be wiring in LLM-powered auto-evaluations so each job post gets a fit-score — basically, a tiny robo-recruiter that tells us how likely we are to be a match.

Any contributions are welcome — just do a PR, keep it tidy, and don’t forget to add tests or a convincing commit message. Thanks!


---

## Prerequisites

* Node.js **18+** (we rely on built-in `fetch` in examples and modern ESM/CJS compatibility). Use `node -v` to check.
* npm (comes with Node) or Yarn.
* Internet access (for Puppeteer to download Chromium and to call Airtable).
* An Airtable account and a base where we can write records.

---

## Quick setup (commands)

```bash
# clone repo (if not already)
git clone <repo-url>
cd <repo-folder>

# initialize & install dependencies
npm install

node scrape-indeed.js
```

---

## Environment variables (`.env`)

Create a `.env` file in the repository root (add `.env` to `.gitignore`). **Never commit real tokens.**

Example `.env` (use placeholders — replace with real values):

```ini
# Airtable Personal Access Token (PAT) — starts with "pat"
AIRTABLE_TOKEN="patREPLACE_WITH_YOURS"

# Airtable Base ID — looks like appXXXXXXXXXXXX
AIRTABLE_BASE="appREPLACE_WITH_YOURS"

# Airtable Table name (exact, case-sensitive)
AIRTABLE_TABLE="indeed"

# Optional: any other runtime toggles
# HEADLESS=false            # if we want to run non-headless for debugging
```

**How to get these values:**

* **Personal Access Token (PAT)**: Sign into Airtable → Account menu → *Developer hub* → *Create new token*. Give it a descriptive name, and select minimal scopes (e.g. `data.records:read` and `data.records:write`). Copy the token once — Airtable shows PAT only at creation.
* **Base ID**: Visit [https://airtable.com/api](https://airtable.com/api), pick the base you want to use. The top of the generated API docs shows `The ID of this base is appXXXXXXXXXXXX`. Use that `app...` string.
* **Table name**: Use the exact table name shown in the Airtable UI (case-sensitive). If the table name contains spaces or special characters, ensure the same exact string is used in `AIRTABLE_TABLE`.

---

## Running the scraper

1. Ensure `.env` is populated with the correct values.
2. Run the script:

```bash
node scrape-indeed.js
# or npm start if script is configured
```

3. Output:

   * Airtable records will be created in the specified table (if `airtable.createRecords` calls succeed).
   * `page-snapshot.png` is written for a visual snapshot of the listing page.

---

## Common issues & troubleshooting

### 401 / permission errors when calling Airtable

* Confirm that `AIRTABLE_TOKEN` is a valid PAT that starts with `pat`.
* Confirm PAT has the `data.records:read` and/or `data.records:write` scopes.
* Confirm `AIRTABLE_BASE` is an `app...` Base ID, **not** the base friendly name.
* Confirm `AIRTABLE_TABLE` matches the table name exactly.
* If still failing, try a curl call to the Airtable REST endpoint to verify token/scope:

  ```bash
  curl -H "Authorization: Bearer ${AIRTABLE_TOKEN}" "https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?maxRecords=1"
  ```

### 404 or missing fields from scraping

* Site HTML can vary across regions, A/B tests, and sponsored vs organic results. The scraper uses selectors from a sample HTML; if pages differ we may get `N/A` fields.
* Inspect the page returned by the script (open `page-snapshot.png`) or run Puppeteer in non-headless mode by setting `headless: false` in `puppeteer.launch()` to debug selectors visually.

### Puppeteer download or launch errors

* On first `npm install`, Puppeteer downloads Chromium. If your environment blocks downloads (CI, firewall), set `PUPPETEER_SKIP_DOWNLOAD=true` and ensure you provide a compatible Chromium via `PUPPETEER_EXECUTABLE_PATH`.
* For Linux headless servers, ensure required libs are installed (libnss, libatk, etc.). See Puppeteer troubleshooting docs.

### Rate limits & polite scraping

* Don’t hammer any job-site; add delays between requests if running at scale.
* Add exponential backoff for HTTP failures.
* Use a realistic `User-Agent` header if required by the site (we kept defaults minimal to avoid changing logic).

---

## Security & best practices

* Treat PATs like passwords. Use environment secrets in CI (GitHub Actions secrets, Render secrets, etc.), not `.env` in repos.
* For deployed apps, use a secret manager (AWS Secrets Manager, Azure Key Vault, etc.) or platform-provided environment variables.
* Limit PAT scopes to minimal permissions and restrict to specific bases when possible.
* Rotate PATs periodically and revoke any that may have leaked.

---

## Deploying (free/cheap hosts)

We can deploy as:

* A scheduled job on a small VM (Render, Fly.io, Railway) or
* A serverless function that triggers scraping (Vercel/Netlify functions) — but serverless cold-starts and runtime limitations may make Puppeteer usage tricky.
  For persistent full-Chromium Puppeteer runs, prefer Fly.io or Render.

---

## Development tips

* Add an `--headless=false` toggle while debugging so we can actually see the browser.
* Add robust logging (`console.debug` + file logs) when running at scale.
* Add unit/integration tests for the HTML parsing functions using saved HTML snippets to reduce breakage caused by live site changes.

---

## Checklist — what we need and what we did

* [ ] **Ignore banned list of companies** (skip saving/sending to Airtable if company name matches a blacklist stored in a config file or `.env`).
* [ ] **Use OpenAI API to auto-evaluate/rate job posts** (analyze scraped description/title and output a score or tag indicating fit, then store in Airtable).

