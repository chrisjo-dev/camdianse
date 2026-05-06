# Cambodia Pharmacy Finder MVP

Phnom Penh-first demo implementation of a pharmacy finder platform for foreigners in Cambodia.

## Run locally

```bash
npm start
```

Open:

- User app: `http://localhost:3000`
- Pharmacist console: `http://localhost:3000/pharmacist`

## Static deployment

This project is now static-deployable on GitHub Pages.

- User and pharmacist flows run in the browser using `localStorage`
- Demo state is shared across the user app and pharmacist console in the same browser
- Map rendering uses `Leaflet + OpenStreetMap`, so no API key is required

After pushing to `main`, GitHub Actions deploys the `public/` directory to Pages using `.github/workflows/deploy-pages.yml`.

## Test

```bash
npm test
```

## Included MVP behaviors

- Ingredient and product search with grouped ingredient results
- Nearby pharmacy lookup by product and radius
- Same-day inventory filtering with `GREEN`, `YELLOW`, `RED`
- Inquiry creation and pharmacist status transitions
- User inquiry timeline and pharmacist notification badge flow
- Leaflet + OpenStreetMap map integration with no secret required
- Static GitHub Pages deployment with browser-persisted demo state
