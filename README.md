# Cambodia Pharmacy Finder MVP

Phnom Penh-first demo implementation of a pharmacy finder platform for foreigners in Cambodia.

## Run locally

```bash
GOOGLE_MAPS_API_KEY=your_key_here npm start
```

If you want to run without a key, the app still works, but the map panel will show a setup message instead of a live Google map.

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
- Google Maps is configured through `public/app-config.js` for local preview
- GitHub Pages deployment injects `GOOGLE_MAPS_API_KEY` from the repository secret of the same name

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
- Google Maps JavaScript API integration via `GOOGLE_MAPS_API_KEY`
- Static GitHub Pages deployment with browser-persisted demo state
