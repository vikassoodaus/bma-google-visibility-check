import { createVisibilityPdf } from '../lib/report-pdf.js';

function setCors(res){
  const origin=process.env.ALLOWED_ORIGIN||'*';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

function safeText(value,max=300){
  return String(value??'').trim().slice(0,max);
}

function validEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());
}

async function sendWebhook(payload){
  const url=process.env.GHL_WEBHOOK_URL;
  if(!url)return {sent:false,reason:'not-configured'};

  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(7000),
    });
    return {sent:response.ok,status:response.status};
  }catch(error){
    return {sent:false,reason:error?.message||'webhook-failed'};
  }
}

export default async function handler(req,res){
  setCors(res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});

  try{
    const lead=req.body?.lead||{};
    const scan=req.body?.scan||{};

    const firstName=safeText(lead.firstName,80);
    const businessName=safeText(lead.businessName,120);
    const email=safeText(lead.email,160);

    if(!firstName)return res.status(400).json({error:'First name is required.'});
    if(!validEmail(email))return res.status(400).json({error:'A valid email is required.'});
    if(lead.consent!==true)return res.status(400).json({error:'Consent is required.'});

    if(!scan?.success||!scan?.business?.domain||!scan?.categories||!scan?.score){
      return res.status(400).json({error:'The Google Visibility Check data is missing or invalid. Please run the check again.'});
    }

    const issues=scan.topIssues||[];
    const issue1=issues[0]?.title||'No high-priority visibility issue detected';
    const issue2=issues[1]?.title||'No additional high-priority visibility issue detected';
    const issue3=issues[2]?.title||'No further high-priority visibility issue detected';

    const payload={
      source:'BMA Google Visibility Check',
      submittedAt:new Date().toISOString(),

      contact:{
        firstName,
        email,
        businessName,
        website:scan.business.finalUrl||scan.business.requestedUrl,
      },

      // Flat fields make GHL mapping simple.
      visibilityBusinessName:scan.business.submittedName,
      visibilityLocation:scan.business.location,
      visibilityWebsite:scan.business.finalUrl||scan.business.requestedUrl,
      visibilityDomain:scan.business.domain,
      visibilityOverallResult:scan.score.overall,
      visibilityConfirmedScore:scan.score.confirmedScore,
      visibilityVerifiedMax:scan.score.verifiedMax,
      visibilityResultLabel:scan.score.label,
      visibilityGBP:scan.categories.gbp?.score??null,
      visibilityReviews:scan.categories.reviews?.score??null,
      visibilityLocal:scan.categories.local?.score??null,
      visibilitySEO:scan.categories.seo?.score??null,
      visibilityTechnical:scan.categories.technical?.score??null,
      visibilityTracking:scan.categories.tracking?.score??null,
      visibilityIssue1:issue1,
      visibilityIssue2:issue2,
      visibilityIssue3:issue3,
      visibilityGoogleMatch:scan.google?.match?.name||'',
      visibilityGoogleRating:scan.google?.match?.rating??null,
      visibilityGoogleReviewCount:scan.google?.match?.reviewCount??null,
      visibilityGoogleTrusted:Boolean(scan.google?.trusted),

      visibilityCheck:{
        businessName:scan.business.submittedName,
        location:scan.business.location,
        website:scan.business.finalUrl||scan.business.requestedUrl,
        domain:scan.business.domain,
        overallResult:scan.score.overall,
        confirmedScore:scan.score.confirmedScore,
        verifiedMax:scan.score.verifiedMax,
        label:scan.score.label,
        googleBusinessProfile:scan.categories.gbp?.score??null,
        reviews:scan.categories.reviews?.score??null,
        localWebsiteSignals:scan.categories.local?.score??null,
        seo:scan.categories.seo?.score??null,
        technical:scan.categories.technical?.score??null,
        tracking:scan.categories.tracking?.score??null,
        issue1,
        issue2,
        issue3,
      }
    };

    // Send lead first so a future PDF error never loses the lead.
    const webhook=await sendWebhook(payload);

    const pdfBytes=await createVisibilityPdf({
      lead:{firstName,businessName,email},
      scan
    });

    res.setHeader('X-BMA-Lead-Webhook',webhook.sent?'sent':'not-sent');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="BMA-Google-Visibility-Report-${scan.business.domain.replace(/[^a-z0-9.-]/gi,'-')}.pdf"`
    );
    res.setHeader('Cache-Control','no-store');

    return res.status(200).send(Buffer.from(pdfBytes));
  }catch(error){
    return res.status(500).json({error:error?.message||'We could not generate the report.'});
  }
}
