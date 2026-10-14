function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n))}

function resultLabel(score){
  if(score>=85)return 'Strong local visibility foundation';
  if(score>=70)return 'Visible, with opportunities';
  if(score>=50)return 'Local visibility needs attention';
  return 'Harder to find than it should be';
}

function addFinding(list, condition, item){ if(condition) list.push(item); }

export function scoreVisibility({ placeResult, home, pages, searchFiles, pageSpeed }) {
  const candidatePlace = placeResult.match;
  const trustedPlace = Boolean(candidatePlace && placeResult.confidence === 'high');
  const place = trustedPlace ? candidatePlace : null;
  const findings=[];
  const wins=[];
  const categories={};

  if (candidatePlace && !trustedPlace) {
    findings.push({
      family:'gbp_match',
      loss:6,
      impact:1.5,
      title:'Google Business Profile match needs verification',
      text:`Google returned "${candidatePlace.displayName?.text || 'a possible listing'}", but the match confidence is ${placeResult.confidence}. We did not use its rating or reviews in the result.`,
      recommendation:'Check the business name, service area and website. Service-area businesses may hide their street address, so the website/domain match is especially important.'
    });
  }

  // 1. Google Business Profile — 25
  let gbp=0;
  if(place){gbp+=6;wins.push({family:'gbp',title:'Google business listing found',text:'We found a matching business on Google.'})}
  addFinding(findings,!place,{family:'gbp',loss:6,impact:1.5,title:'Google business listing was not confidently matched',text:'We could not confidently match the business details to a Google place result.',recommendation:'Confirm the business name and location, then make sure the Google Business Profile is claimed and accurate.'});

  const websiteMatch = Boolean(place?.websiteUri) && (()=>{try{return new URL(place.websiteUri).hostname.replace(/^www\./,'')===new URL(home.url).hostname.replace(/^www\./,'')}catch{return false}})();
  if(websiteMatch) gbp+=4;
  else if(place?.websiteUri) gbp+=2;
  addFinding(findings,place && !websiteMatch,{family:'gbp',loss:2,impact:1.25,title:'Google and website signals do not fully line up',text:'The website returned by Google does not clearly match the website submitted for this check.',recommendation:'Make sure the Google Business Profile links to the correct canonical website.'});

  if(place?.nationalPhoneNumber)gbp+=3; else addFinding(findings,place && !place?.nationalPhoneNumber,{family:'gbp',loss:3,impact:1,title:'Phone details were not detected on the Google listing',text:'A direct phone number was not returned for the matched business.',recommendation:'Review the phone details on the Google Business Profile.'});
  const serviceAreaMode = home.locationScopeType === 'service-area';
  if(place?.formattedAddress) gbp+=3;
  else if(serviceAreaMode && place) gbp+=3;
  if(place?.regularOpeningHours?.weekdayDescriptions?.length)gbp+=3; else addFinding(findings,place && !place?.regularOpeningHours?.weekdayDescriptions?.length,{family:'gbp',loss:3,impact:1,title:'Opening hours were not detected',text:'Google did not return regular opening hours for this business.',recommendation:'Add or verify regular and holiday opening hours on the Google Business Profile.'});
  if(place?.primaryType || place?.primaryTypeDisplayName?.text)gbp+=2;
  if(typeof place?.rating==='number')gbp+=2;
  if(Number(place?.userRatingCount||0)>0)gbp+=2;
  categories.gbp=trustedPlace
    ? {name:'Google Business Profile',score:clamp(gbp,0,25),max:25}
    : {name:'Google Business Profile',score:null,max:25,verified:false};

  // 2. Reviews — 15
  // Rating quality and review depth are intentionally scored separately.
  // One poor review should never look like a reasonably healthy reputation.
  const rating=Number(place?.rating||0), count=Number(place?.userRatingCount||0);
  let reviews=0;

  // Rating quality — max 6
  if(rating>=4.5) reviews+=6;
  else if(rating>=4.0) reviews+=4.5;
  else if(rating>=3.5) reviews+=2.5;
  else if(rating>=3.0) reviews+=1;
  else if(rating>0) reviews+=0;

  // Review depth — max 5
  if(count>=100) reviews+=5;
  else if(count>=30) reviews+=4;
  else if(count>=10) reviews+=3;
  else if(count>=5) reviews+=2;
  else if(count>=2) reviews+=1;
  else if(count===1) reviews+=0.5;

  // Credibility combination — max 4
  if(rating>=4.3 && count>=30) reviews+=4;
  else if(rating>=4.0 && count>=10) reviews+=2.5;
  else if(rating>=4.0 && count>=5) reviews+=1.5;
  else if(rating>=3.5 && count>=5) reviews+=0.5;

  categories.reviews=trustedPlace
    ? {name:'Reviews & Reputation',score:clamp(Math.round(reviews*10)/10,0,15),max:15}
    : {name:'Reviews & Reputation',score:null,max:15,verified:false};

  if(place && rating>0 && rating<=2.5 && count<=3){
    findings.push({
      family:'reviews',
      loss:6,
      impact:1.55,
      title:'Your current Google review profile is very weak',
      text:`The matched listing has ${count} review${count===1?'':'s'} with a ${rating.toFixed(1)} star rating.`,
      recommendation:'Prioritise service recovery, respond professionally to existing feedback, and build a genuine ongoing review-request process before pushing harder for local visibility.'
    });
  } else {
    addFinding(findings,place && rating>0 && rating<4,{
      family:'reviews',
      loss:4,
      impact:1.3,
      title:'Your Google rating could be stronger',
      text:`The matched business has a ${rating.toFixed(1)} Google rating from ${count} review${count===1?'':'s'}.`,
      recommendation:'Focus on service recovery, review requests and consistent responses before pushing harder for visibility.'
    });
  }

  addFinding(findings,place && count<10,{
    family:'reviews',
    loss:4,
    impact:1.25,
    title:count===0?'Google reviews have not started yet':'Google review volume is still light',
    text:count===0
      ? 'We found no Google reviews on the matched listing.'
      : `We found ${count} Google review${count===1?'':'s'} on the matched listing.`,
    recommendation:'Build a steady, policy-compliant review-request process so trust and local credibility continue to grow.'
  });

  if(rating>=4.5 && count>=30)wins.push({
    family:'reviews',
    title:'Strong review credibility',
    text:`The matched listing has a ${rating.toFixed(1)} rating from ${count} reviews.`
  });

  // 3. Local / Service-Area Website Signals — 20
  const allPages=[home,...pages];
  const any=(key)=>allPages.some((p)=>p?.[key]);
  let local=0;

  const exactBody=allPages.some((p)=>p?.locationBodyStrength==='exact');
  const broadBody=allPages.some((p)=>p?.locationBodyStrength==='broad');

  if(exactBody){
    local+=5;
  } else if(broadBody){
    local+=2.5;
    findings.push({
      family:'local',
      loss:2.5,
      impact:1.0,
      title:'Specific local relevance could be stronger',
      text:`The website references the broader region${home.locationBroadLabel?` (${home.locationBroadLabel})`:''}, but we could not clearly verify the specific area entered (${home.locationScopeLabel || 'local area'}).`,
      recommendation:'Keep the broader regional positioning, but add the genuine local/service-area relationship where it is useful to customers rather than forcing the location into every page.'
    });
  } else {
    addFinding(findings,true,{
      family:'local',
      loss:5,
      impact:1.35,
      title:serviceAreaMode?'Service-area relevance on the website is weak':'Local relevance on the website is weak',
      text:serviceAreaMode
        ? `We could not clearly connect the website copy to the entered service area (${home.locationScopeLabel || 'service area'}).`
        : 'We could not clearly connect the website copy to the suburb or city entered.',
      recommendation:serviceAreaMode
        ? 'Make the genuine service area clear in useful page copy. A service-area business does not need to publish a street address.'
        : 'Make the real service area clear in useful page copy, not just in the footer.'
    });
  }

  if(any('phoneLink') || any('emailLink')) local+=3;

  // A hidden street address is normal for many service-area businesses.
  if(serviceAreaMode){
    if(home.servicePath || pages.some((p)=>p.servicePath)) local+=3;
  } else if(any('addressLike')){
    local+=3;
  }

  if(any('localBusinessSchema')) local+=4;
  else if(any('organizationSchema')) local+=2;

  addFinding(findings,!any('localBusinessSchema'),{
    family:'local_schema',
    loss:2,
    impact:1,
    title:'LocalBusiness schema was not detected',
    text:'We did not find structured data clearly describing the business as a local entity.',
    recommendation:serviceAreaMode
      ? 'Use appropriate LocalBusiness/Organization structured data and represent the service area accurately without publishing a hidden address.'
      : 'Add appropriate LocalBusiness structured data with consistent business details.'
  });

  if(home.contactPath) local+=2;
  if(home.locationPath || pages.some((p)=>p.locationPath)) local+=3;

  categories.local={
    name:serviceAreaMode?'Service Area Website Signals':'Local Website Signals',
    score:clamp(local,0,20),
    max:20
  };

  // 4. On-page SEO — 15
  let seo=0;
  if(home.title && home.title.length>=20)seo+=3; else addFinding(findings,true,{family:'seo',loss:3,impact:1.1,title:'Homepage SEO title needs attention',text:'The homepage title is missing or too weak to provide clear search context.',recommendation:'Use a concise title that explains the primary service and, where natural, the main location.'});
  if(home.metaDescription && home.metaDescription.length>=60)seo+=3; else addFinding(findings,true,{family:'seo_meta',loss:3,impact:1,title:'Meta description needs attention',text:'The homepage meta description is missing or unusually short.',recommendation:'Add a clear description that explains the offer and gives searchers a reason to visit.'});
  if(home.h1)seo+=3; else addFinding(findings,true,{family:'seo_headings',loss:3,impact:1,title:'Primary heading was not detected',text:'We could not verify a clear H1 on the homepage.',recommendation:'Use one clear primary heading that describes the page topic or offer.'});
  const exactSeoLocation=[
    home.locationTitleStrength,
    home.locationMetaStrength,
    home.locationH1Strength
  ].includes('exact');

  const broadSeoLocation=[
    home.locationTitleStrength,
    home.locationMetaStrength,
    home.locationH1Strength
  ].includes('broad');

  if(exactSeoLocation){
    seo+=3;
  } else if(broadSeoLocation){
    seo+=1.5;
    findings.push({
      family:'local',
      loss:1.5,
      impact:.9,
      title:'Search metadata has broad regional context',
      text:`The homepage references the broader region${home.locationBroadLabel?` (${home.locationBroadLabel})`:''}, but not the specific area entered (${home.locationScopeLabel || 'local area'}).`,
      recommendation:'Only add the specific area to titles/headings where it reflects a real service relationship and reads naturally.'
    });
  } else {
    addFinding(findings,true,{
      family:'local',
      loss:3,
      impact:1.2,
      title:serviceAreaMode?'Search metadata has limited service-area context':'Search metadata has limited local context',
      text:serviceAreaMode
        ? `The entered service area (${home.locationScopeLabel || 'service area'}) was not detected in the homepage title, description or primary heading.`
        : 'The entered location was not detected in the homepage title, description or primary heading.',
      recommendation:serviceAreaMode
        ? 'Where natural, connect the core offer with the genuine service area in important search signals.'
        : 'Where relevant and natural, connect the core service with the primary location in important search signals.'
    });
  }
  if(!home.noindex && searchFiles.sitemapFound)seo+=3; else if(!home.noindex)seo+=1.5;
  if(home.noindex)addFinding(findings,true,{family:'indexing',loss:5,impact:1.5,title:'Homepage appears to be set to noindex',text:'The homepage is telling search engines not to index it.',recommendation:'Remove noindex before expecting the page to appear in organic search.'});
  categories.seo={name:'On-Page SEO',score:clamp(seo,0,15),max:15};

  // 5. Technical Search Health — 15
  let tech=0;
  if(home.url.startsWith('https://'))tech+=2;
  if(home.viewport)tech+=2;
  if(searchFiles.sitemapFound)tech+=2;
  if(!home.noindex)tech+=2;
  if(home.canonical)tech+=1;
  if(pageSpeed.available){
    const ps=Number(pageSpeed.performanceScore||0);
    if(ps>=90)tech+=6; else if(ps>=75)tech+=5; else if(ps>=60)tech+=3.5; else if(ps>=40)tech+=2; else tech+=0.5;
    addFinding(findings,ps<60,{family:'performance',loss:4,impact:1.35,title:'Mobile performance needs attention',text:`Google PageSpeed returned a mobile performance result of ${ps}/100.`,recommendation:'Start with large images, render-blocking scripts and heavy third-party tools.'});
    if(ps>=75)wins.push({family:'performance',title:'Healthy mobile performance',text:`Mobile PageSpeed is ${ps}/100.`});
  }
  categories.technical={name:'Technical Search Health',score:clamp(Math.round(tech*10)/10,0,15),max:15,partial:!pageSpeed.available};

  // 6. Tracking & Conversion — 10
  let track=0;
  if(home.ga4)track+=3;
  if(home.gtm)track+=2;
  if(home.googleAds)track+=1;
  if(home.directContact || home.cta)track+=2;
  if(home.formPresent)track+=2;
  categories.tracking={name:'Tracking & Conversion',score:clamp(track,0,10),max:10};
  addFinding(findings,!home.ga4 && !home.gtm,{family:'tracking',loss:3,impact:1.1,title:'Analytics was not detected',text:'We could not verify Google Analytics or Google Tag Manager on the homepage.',recommendation:'Install reliable analytics before making larger marketing decisions.'});
  if((home.directContact || home.cta) && home.formPresent)wins.push({family:'conversion',title:'Clear enquiry path detected',text:'Visitors have clear ways to contact or enquire from the website.'});

  const verifiedCategories=Object.values(categories).filter((c)=>typeof c.score==='number');
  const confirmedScore=Math.round(verifiedCategories.reduce((s,c)=>s+c.score,0));
  const verifiedMax=verifiedCategories.reduce((s,c)=>s+c.max,0);
  const coverage=verifiedMax/100;
  const overall=verifiedMax===100 ? confirmedScore : null;
  const familySeen=new Set();
  const topIssues=findings
    .map((f)=>({...f,priority:(f.loss||1)*(f.impact||1)}))
    .sort((a,b)=>b.priority-a.priority)
    .filter((f)=>{if(familySeen.has(f.family))return false;familySeen.add(f.family);return true;})
    .slice(0,3);

  const uniqueWins=[]; const winFamilies=new Set();
  for(const w of wins){if(winFamilies.has(w.family))continue;winFamilies.add(w.family);uniqueWins.push(w);if(uniqueWins.length>=3)break;}

  return {
    overall,
    confirmedScore,
    verifiedMax,
    coverage,
    provisional: overall===null,
    label: overall===null ? 'Provisional result' : resultLabel(overall),
    categories,
    topIssues,
    wins:uniqueWins,
  };
}
