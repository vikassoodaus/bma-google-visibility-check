# BMA Google Visibility Check — V1.0

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
