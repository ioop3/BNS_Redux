# subway
Source code for https://jpwright.github.io/subway/.

## Development

Pre-requisites: `node`

`npm install`

To run: `npx http-server -c-1`

Run the command from this project folder and open the localhost URL printed by the server. The `-c-1` option disables asset caching so updated styles and scripts appear after refresh. Do not open `index.html` directly: browsers block the preset-map JSON requests from `file://` pages.

The legacy Express server also serves this same game: run `npm install --prefix server` from this project folder, then `node server/server.js` and open `http://localhost:3000`. It serves the canonical files in this project root instead of the old placeholder files under `server/static`.

Saved games use a versioned JSON format that keeps line IDs, deleted lines, and branch/diamond relationships. Saves from the original site are still accepted and upgraded when loaded.

### File Generations
Hopefully these steps are only necessary to do once per decade:

#### everything.geojson
You can download the latest `.geojson` for NYC from https://www.nyc.gov/site/planning/data-maps/open-data/census-download-metadata.page.
Choose `2020 Census Tracts (Water Areas Included)`.
Copy/paste the results into `json/everything.geojson`.

#### population.json

Download the latest census results from `nyc.gov`, e.g. for [2020](https://www.nyc.gov/site/planning/planning-level/nyc-population/). This gets downloaded as a `.xlsx` file. Using an online tool of your choice, convert the `2020` data into a `.json` file file and save them into every file in this repo called `population.json`.

One possible conversion:
1. Import `.xlsx` file into google sheets.
2. Delete all the tabs besides 2020 and redownload.
3. Import the redownloaded file into `https://kinoar.github.io/xlsx-to-json/` and click `Download Localization JSON`.

#### demand.json

To re-generate `demand.json` file: `node tools/demanderator.js`

Make sure to copy/paste into `json/demand.json`.
