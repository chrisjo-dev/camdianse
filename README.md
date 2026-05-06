# Cambodia Pharmacy Finder MVP

Phnom Penh-first demo implementation of a pharmacy finder platform for foreigners in Cambodia.

## Run

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
