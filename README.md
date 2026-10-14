# BMA Google Visibility Check — V1.2

Development build for validating the local-visibility scoring engine before the public GHL experience is designed.

## What V1 checks

- Google Business Profile / Google place match
- Rating and review volume
- Website/local-detail consistency
- Location signals on the website
- LocalBusiness structured data
- Title, meta description and H1
- Indexability and sitemap
- HTTPS and mobile viewport
- Google PageSpeed mobile performance
- GA4 / GTM / Google Ads detection
- Enquiry/contact paths

## Scoring model — 100 points

- Google Business Profile — 25
- Reviews & Reputation — 15
- Local Website Signals — 20
- On-Page SEO — 15
- Technical Search Health — 15
- Tracking & Conversion — 10

## Required Vercel environment variables

### GOOGLE_PLACES_API_KEY
Create a Google Maps Platform API key with **Places API (New)** enabled. Restrict the key to Places API (New).

### GOOGLE_PAGESPEED_API_KEY
You can reuse the PageSpeed API key already used by the BMA Website Check project, or create a dedicated key.

## Google Places usage

V1 makes one Text Search (New) request per scan and requests only the fields needed for the visibility model. It does not perform a geo-grid rank scan and does not claim an exact Maps ranking.

## Deploy

Create a new GitHub repository, for example:

`bma-google-visibility-check`

Upload the contents of this folder to the repository root and import the repository into Vercel.

## First validation sites

Use businesses where you already know the Google profile and website details. Verify that the matched Google listing is the correct business before trusting the score.


## V1.2 matching safety

- Review and Google Business Profile scores are only used when the Google place match is high confidence.
- Low/medium-confidence candidates remain visible in diagnostics but do not contribute rating/review points.
- A second Places Text Search is only used when the first match is weak; it uses the submitted website domain to reduce same-name false matches.
- When Google identity cannot be verified, the result becomes provisional and shows verified points rather than pretending uncertain Google data is correct.


## V1.2 service-area businesses

The third input now accepts a real **service area**, not only a suburb/city.

Examples:
- `San Jose`
- `Melbourne`
- `UK`
- `Australia`

For broad service-area businesses:
- a hidden street address is not treated as a weakness;
- national/service-area wording is recognised on the website;
- local website scoring becomes **Service Area Website Signals**;
- the website/domain remains the strongest Google Business Profile identity signal.
