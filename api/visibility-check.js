import { normaliseUrl, assertPublicUrl } from '../lib/security.js';
import { safeFetch } from '../lib/fetch-site.js';
import { runPageSpeed } from '../lib/pagespeed.js';
import { findGoogleBusiness } from '../lib/places.js';
import { analyseLocalPage, chooseLocalPages } from '../lib/site-analysis.js';
import { inspectSearchFiles } from '../lib/robots.js';
import { scoreVisibility } from '../lib/scoring.js';
import { buildLocationScope } from '../lib/location-scope.js';

function setCors(res){
  const origin=process.env.ALLOWED_ORIGIN||'*';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

export default async function handler(req,res){
  setCors(res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({success:false,error:'Method not allowed.'});

  const started=Date.now();
  try{
    const businessName=String(req.body?.businessName||'').trim();
    const location=String(req.body?.location||'').trim();
    if(!businessName)throw new Error('Enter the business name.');
    if(!location)throw new Error('Enter the service area, suburb or city.');

    const locationScope=buildLocationScope(location);
    const requestedUrl=normaliseUrl(req.body?.website);
    await assertPublicUrl(requestedUrl);

    const [homeFetch,placeResult,pageSpeed]=await Promise.all([
      safeFetch(requestedUrl,{timeoutMs:10000}),
      findGoogleBusiness({businessName,website:requestedUrl.toString(),location}),
      runPageSpeed(requestedUrl.toString()),
    ]);

    if(!homeFetch.body)throw new Error('We could not read usable HTML from this website.');
    const home=analyseLocalPage(homeFetch.body,homeFetch.finalUrl.toString(),locationScope);

    const [searchFiles,selections]=await Promise.all([
      inspectSearchFiles(homeFetch.finalUrl.toString()),
      Promise.resolve(chooseLocalPages(home,3)),
    ]);

    const pages=(await Promise.all(selections.map(async(item)=>{
      try{
        const fetched=await safeFetch(item.url,{timeoutMs:7000});
        if(!fetched.body)return null;
        return {...analyseLocalPage(fetched.body,fetched.finalUrl.toString(),locationScope),_reason:item.reason};
      }catch{return null;}
    }))).filter(Boolean);

    const scored=scoreVisibility({placeResult,home,pages,searchFiles,pageSpeed});
    const place=placeResult.match;

    return res.status(200).json({
      success:true,
      business:{
        submittedName:businessName,
        location,
        locationScopeType:locationScope.type,
        locationScopeLabel:locationScope.label,
        requestedUrl:requestedUrl.toString(),
        finalUrl:homeFetch.finalUrl.toString(),
        domain:new URL(homeFetch.finalUrl).hostname,
      },
      google:{
        available:placeResult.available,
        confidence:placeResult.confidence||'none',
        match:place?{
          id:place.id,
          name:place.displayName?.text||'',
          address:place.formattedAddress||'',
          website:place.websiteUri||'',
          phone:place.nationalPhoneNumber||'',
          rating:place.rating??null,
          reviewCount:place.userRatingCount??0,
          category:place.primaryTypeDisplayName?.text||place.primaryType||'',
          businessStatus:place.businessStatus||'',
          mapsUrl:place.googleMapsUri||'',
          openingHours:place.regularOpeningHours?.weekdayDescriptions||[],
          matchScore:place._matchScore||0,
          exactWebsite:Boolean(place._exactWebsite),
          nameSimilarity:place._nameSimilarity??0,
          locationSimilarity:place._locationSimilarity??0,
          pureServiceAreaBusiness:Boolean(place._pureServiceAreaBusiness),
        }:null,
        trusted:Boolean(placeResult.trusted),
        fallbackQueryUsed:Boolean(placeResult.fallbackQueryUsed),
        error:placeResult.available?null:placeResult.error,
      },
      score:{
        overall:scored.overall,
        confirmedScore:scored.confirmedScore,
        verifiedMax:scored.verifiedMax,
        coverage:scored.coverage,
        provisional:scored.provisional,
        label:scored.label
      },
      categories:scored.categories,
      topIssues:scored.topIssues.map(({family,title,text,recommendation,priority})=>({family,title,text,recommendation,priority})),
      wins:scored.wins,
      technical:{
        pageSpeedAvailable:pageSpeed.available,
        pageSpeedScore:pageSpeed.performanceScore??null,
        pageSpeedError:pageSpeed.available?null:pageSpeed.error,
        sitemapFound:searchFiles.sitemapFound,
        sitemapUrl:searchFiles.sitemapUrl,
        sampledPages:[home.url,...pages.map((p)=>p.url)],
        selectedPages:selections,
      },
      meta:{version:'1.3.0',durationMs:Date.now()-started},
    });
  }catch(error){
    return res.status(400).json({success:false,error:error?.message||'Visibility check failed.'});
  }
}
