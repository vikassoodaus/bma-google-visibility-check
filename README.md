# BMA Google Visibility Check — V2.0 Public

This version turns the tested V1.4 engine into the public-facing BMA Google Visibility Check.

## Included

- Public BMA-branded interface
- Business Name + Website + Service Area/Suburb/City input
- Animated six-colour progress bar
- Skippy movement during the scan
- Trusted Google Business Profile matching
- Service-area business support
- Six visibility categories
- Top 3 visibility opportunities
- Positive findings
- Hidden developer diagnostics with `?debug=1`
- GHL/GHL-page embed mode with `?embed=1`
- Auto-height messages for the GHL iframe
- Lead capture after results
- 6-page PDF Google Visibility Report
- Optional GoHighLevel webhook

## Environment variables

Keep/add:

`GOOGLE_PLACES_API_KEY`

`GOOGLE_PAGESPEED_API_KEY`

Optional for lead capture:

`GHL_WEBHOOK_URL`

If the webhook is not configured, PDF generation still works.

## GHL embed mode

Use:

`https://YOUR-VERCEL-URL/?embed=1`

The app hides its own standalone header/footer and reports its changing height to the parent page with:

`bma-google-visibility-check-height`

## Developer diagnostics

Use:

`?debug=1`

or:

`?embed=1&debug=1`

## Search indexing

The public app currently contains:

`<meta name="robots" content="noindex,nofollow">`

Keep this while testing. Remove it when the public Google Visibility Check page is ready for indexing.

## Recommended GHL page slug

`/google-visibility-check`
