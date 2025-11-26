# Kenya Real Estate Scraper

Apify Actor for scraping real estate listings from local Kenyan and East African Community (EAC) classifieds. This scraper crawls listings from popular classifieds like BuyRentKenya and Jiji, then normalizes prices, locations, contact info, and images into a consistent format.

## Features

- **Multiple Sources**: Scrapes from BuyRentKenya, Jiji, and extensible to other EAC classifieds
- **Price Normalization**: Handles KES/USD conversion and various price formats (K, M suffixes, etc.)
- **Location Parsing**: Extracts area, city, and region from location strings
- **Contact Extraction**: Normalizes Kenyan phone numbers (+254 format) and emails
- **Image Collection**: Aggregates all property images
- **Property Features**: Extracts bedrooms, bathrooms, size, and other amenities

## Target Users

- Brokers looking to aggregate listings
- Investors researching the Kenyan property market
- Data researchers analyzing real estate trends

## Input Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sources` | array | `["buyrentkenya", "jiji"]` | List of classifieds to scrape |
| `listingType` | string | `"all"` | Filter: `all`, `sale`, or `rent` |
| `propertyType` | string | `"all"` | Filter: `all`, `house`, `apartment`, `land`, `commercial` |
| `location` | string | `""` | Filter by location (e.g., "Nairobi", "Mombasa") |
| `maxListings` | integer | `100` | Maximum listings to scrape per source |
| `currency` | string | `"KES"` | Output currency: `KES` or `USD` |
| `proxyConfiguration` | object | `null` | Proxy settings for the scraper |

## Example Input

```json
{
  "sources": ["buyrentkenya", "jiji"],
  "listingType": "sale",
  "propertyType": "apartment",
  "location": "Nairobi",
  "maxListings": 50,
  "currency": "KES"
}
```

## Output Format

Each listing is normalized to the following structure:

```json
{
  "id": "12345",
  "source": "buyrentkenya",
  "url": "https://www.buyrentkenya.com/property/12345",
  "title": "3 Bedroom Apartment for Sale in Westlands",
  "description": "Beautiful apartment with modern finishes...",
  "listingType": "sale",
  "propertyType": "apartment",
  "price": {
    "amount": 15000000,
    "currency": "KES",
    "original": "KES 15,000,000"
  },
  "location": {
    "area": "Westlands",
    "city": "Nairobi",
    "region": "Nairobi",
    "original": "Westlands, Nairobi"
  },
  "contact": {
    "name": "John Agent",
    "phone": ["+254722123456"],
    "email": "agent@example.com",
    "whatsapp": null
  },
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "features": {
    "bedrooms": 3,
    "bathrooms": 2,
    "size": { "value": 1500, "unit": "sqft" },
    "parking": "2 spaces",
    "furnished": true
  },
  "postedAt": "2024-01-15",
  "scrapedAt": "2024-01-20T10:30:00.000Z"
}
```

## Running Locally

```bash
# Install dependencies
npm install

# Run the actor
npm start

# Run tests
npm test

# Run linter
npm run lint
```

## Supported Sources

### BuyRentKenya
- Website: https://www.buyrentkenya.com
- Coverage: Kenya-wide real estate listings

### Jiji Kenya
- Website: https://jiji.co.ke
- Coverage: Kenya-wide classifieds including real estate

## License

MIT License - see [LICENSE](LICENSE) for details.
