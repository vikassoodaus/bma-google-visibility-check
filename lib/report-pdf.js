import { PDFDocument, StandardFonts, rgb, PDFString } from 'pdf-lib';

const C={
  ink:rgb(11/255,48/255,44/255),
  dark:rgb(7/255,61/255,54/255),
  text:rgb(72/255,99/255,93/255),
  muted:rgb(113/255,131/255,126/255),
  line:rgb(223/255,232/255,228/255),
  white:rgb(1,1,1),
  blue:rgb(234/255,243/255,255/255),
  lilac:rgb(240/255,235/255,255/255),
  peach:rgb(255/255,240/255,231/255),
  mint:rgb(233/255,246/255,239/255),
  sage:rgb(237/255,245/255,236/255),
  blush:rgb(255/255,237/255,239/255),
};
const PAGE={w:595.28,h:841.89,margin:46};

function safe(value=''){
  return String(value??'')
    .replace(/[✓✔]/g,'PASS')
    .replace(/[→➜➝]/g,'->')
    .replace(/[•·]/g,'-')
    .replace(/[–—]/g,'-')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g,'');
}

function wrap(font,text,size,maxWidth){
  const words=safe(text).split(/\s+/).filter(Boolean);
  const lines=[];
  let line='';
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(font.widthOfTextAtSize(test,size)<=maxWidth)line=test;
    else{if(line)lines.push(line);line=word;}
  }
  if(line)lines.push(line);
  return lines;
}

function drawWrapped(page,font,text,x,y,size,maxWidth,color=C.text,lineHeight=size*1.4){
  const lines=wrap(font,text,size,maxWidth);
  let cursor=y;
  for(const line of lines){
    page.drawText(line,{x,y:cursor,size,font,color});
    cursor-=lineHeight;
  }
  return cursor;
}

function addUrlLink(pdf,page,x,y,width,height,url){
  const annotation=pdf.context.obj({
    Type:'Annot',
    Subtype:'Link',
    Rect:[x,y,x+width,y+height],
    Border:[0,0,0],
    A:{Type:'Action',S:'URI',URI:PDFString.of(url)},
  });
  page.node.addAnnot(pdf.context.register(annotation));
}

function footer(pdf,page,regular,pageNo){
  page.drawLine({
    start:{x:PAGE.margin,y:40},
    end:{x:PAGE.w-PAGE.margin,y:40},
    thickness:1,color:C.line
  });

  const prefix='Business Marketing Agency - ';
  const domain='businessmarketingagency.com.au';

  page.drawText(prefix+domain,{
    x:PAGE.margin,y:24,size:8,font:regular,color:C.muted
  });

  const prefixWidth=regular.widthOfTextAtSize(prefix,8);
  const domainWidth=regular.widthOfTextAtSize(domain,8);
  addUrlLink(pdf,page,PAGE.margin+prefixWidth,22,domainWidth,11,'https://businessmarketingagency.com.au/');

  page.drawText(String(pageNo),{
    x:PAGE.w-PAGE.margin-8,y:24,size:8,font:regular,color:C.muted
  });
}

function title(page,bold,regular,kicker,heading,sub=''){
  page.drawText(safe(kicker).toUpperCase(),{
    x:PAGE.margin,y:PAGE.h-64,size:9,font:bold,color:C.muted
  });
  const after=drawWrapped(page,bold,heading,PAGE.margin,PAGE.h-92,30,PAGE.w-PAGE.margin*2,C.ink,33);
  if(sub)drawWrapped(page,regular,sub,PAGE.margin,after-10,11,PAGE.w-PAGE.margin*2,C.text,16);
}

export async function createVisibilityPdf({lead,scan}){
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);

  const provisional=scan?.score?.overall===null;
  const shown=provisional
    ? Math.round(scan?.score?.confirmedScore||0)
    : Math.round(scan?.score?.overall||0);
  const max=provisional
    ? Math.round(scan?.score?.verifiedMax||0)
    : 100;

  // PAGE 1
  let page=pdf.addPage([PAGE.w,PAGE.h]);
  page.drawRectangle({x:0,y:0,width:PAGE.w,height:PAGE.h,color:C.white});
  page.drawRectangle({x:0,y:PAGE.h-10,width:PAGE.w,height:10,color:C.dark});

  page.drawText('BUSINESS MARKETING AGENCY',{
    x:PAGE.margin,y:PAGE.h-72,size:10,font:bold,color:C.muted
  });
  drawWrapped(page,bold,'Your Google Visibility Report',PAGE.margin,PAGE.h-122,34,370,C.ink,38);
  page.drawText(safe(scan.business?.submittedName||scan.business?.domain||'Business'),{
    x:PAGE.margin,y:PAGE.h-213,size:14,font:regular,color:C.text
  });
  page.drawText(safe(scan.business?.location||''),{
    x:PAGE.margin,y:PAGE.h-234,size:10,font:regular,color:C.muted
  });

  page.drawCircle({x:PAGE.w-135,y:PAGE.h-178,size:72,color:C.blue});
  const scoreText=String(shown);
  const scoreWidth=bold.widthOfTextAtSize(scoreText,44);
  page.drawText(scoreText,{
    x:PAGE.w-135-scoreWidth/2,y:PAGE.h-192,size:44,font:bold,color:C.dark
  });
  page.drawText(provisional?`of ${max} verified`:'out of 100',{
    x:PAGE.w-168,y:PAGE.h-220,size:9,font:regular,color:C.muted
  });

  page.drawText(safe(scan.score?.label||'Google Visibility Result'),{
    x:PAGE.margin,y:PAGE.h-285,size:22,font:bold,color:C.ink
  });

  drawWrapped(
    page,regular,
    `Prepared for ${lead.firstName}${lead.businessName?` at ${lead.businessName}`:''}. This report summarises the Google profile, review, local relevance, SEO, technical and tracking signals BMA could verify.`,
    PAGE.margin,PAGE.h-318,11,PAGE.w-PAGE.margin*2,C.text,17
  );

  page.drawRectangle({
    x:PAGE.margin,y:248,width:PAGE.w-PAGE.margin*2,height:170,
    color:C.sage,borderColor:C.line,borderWidth:1
  });
  page.drawText('What this report is measuring',{
    x:PAGE.margin+20,y:382,size:15,font:bold,color:C.ink
  });
  drawWrapped(
    page,regular,
    'The goal is not to award a vanity grade. The check looks for evidence that Google can understand the business, customers can trust what they find, the website reinforces the service area, and enquiries can be measured.',
    PAGE.margin+20,352,12,PAGE.w-PAGE.margin*2-40,C.text,19
  );
  footer(pdf,page,regular,1);

  // PAGE 2 - Categories
  page=pdf.addPage([PAGE.w,PAGE.h]);
  title(page,bold,regular,'Your result','Six Google visibility signals','A practical view of the foundations supporting or limiting local visibility.');

  const colors=[C.blue,C.lilac,C.peach,C.mint,C.sage,C.blush];
  const entries=Object.entries(scan.categories||{});
  let y=585;

  entries.forEach(([key,cat],index)=>{
    const col=index%2;
    const row=Math.floor(index/2);
    const x=PAGE.margin+col*255;
    const yy=y-row*142;

    page.drawRectangle({
      x,y:yy,width:235,height:118,
      color:colors[index]||C.sage,
      borderColor:C.line,borderWidth:1
    });

    page.drawText(safe(cat.name||key),{
      x:x+16,y:yy+86,size:11,font:bold,color:C.ink
    });

    const display=typeof cat.score==='number'
      ? `${cat.score} / ${cat.max}`
      : 'Not verified';

    page.drawText(display,{
      x:x+16,y:yy+48,size:typeof cat.score==='number'?26:16,font:bold,color:C.dark
    });

    const note=typeof cat.score!=='number'
      ? 'Google identity was not trusted enough to score this area.'
      : (cat.partial?'Some supporting data could not be verified.':'Core checks completed.');

    drawWrapped(page,regular,note,x+16,yy+24,8.5,202,C.text,11);
  });
  footer(pdf,page,regular,2);

  // PAGE 3 - Google profile snapshot
  page=pdf.addPage([PAGE.w,PAGE.h]);
  title(page,bold,regular,'Google profile','What Google returned','The Google Business Profile data used in this check, when the match was trusted.');

  const g=scan.google?.match;
  let py=640;

  if(g && scan.google?.trusted){
    const rows=[
      ['Profile name',g.name||''],
      ['Category',g.category||''],
      ['Rating',typeof g.rating==='number'?`${g.rating.toFixed(1)} stars`:'Not returned'],
      ['Reviews',`${g.reviewCount||0}`],
      ['Phone',g.phone||'Not returned'],
      ['Address / service area',g.address||'Street address hidden / not returned'],
      ['Match confidence',scan.google.confidence||''],
      ['Service-area profile',g.pureServiceAreaBusiness?'Yes':'No'],
    ];

    rows.forEach(([label,value],i)=>{
      page.drawRectangle({
        x:PAGE.margin,y:py-46,width:PAGE.w-PAGE.margin*2,height:54,
        color:i%2===0?C.mint:C.white,
        borderColor:C.line,borderWidth:1
      });
      page.drawText(label,{x:PAGE.margin+16,y:py-17,size:10,font:bold,color:C.ink});
      drawWrapped(page,regular,value,PAGE.margin+180,py-17,10,PAGE.w-PAGE.margin*2-196,C.text,13);
      py-=62;
    });
  }else{
    page.drawRectangle({
      x:PAGE.margin,y:500,width:PAGE.w-PAGE.margin*2,height:145,
      color:C.peach,borderColor:C.line,borderWidth:1
    });
    page.drawText('Google Business Profile match not fully verified',{
      x:PAGE.margin+18,y:606,size:16,font:bold,color:C.ink
    });
    drawWrapped(
      page,regular,
      'The scanner did not use uncertain rating or review data. The website-side visibility checks still completed, but the Google profile and reputation sections remain unscored until identity can be verified confidently.',
      PAGE.margin+18,576,11,PAGE.w-PAGE.margin*2-36,C.text,17
    );
  }
  footer(pdf,page,regular,3);

  // PAGE 4 - opportunities
  page=pdf.addPage([PAGE.w,PAGE.h]);
  title(page,bold,regular,'Priority','Your biggest visibility opportunities','These are ordered by likely impact, not by how technical they sound.');

  let cursor=650;
  const issues=(scan.topIssues||[]).slice(0,3);

  if(!issues.length){
    page.drawRectangle({
      x:PAGE.margin,y:500,width:PAGE.w-PAGE.margin*2,height:130,
      color:C.mint,borderColor:C.line,borderWidth:1
    });
    page.drawText('No high-priority visibility issues detected',{
      x:PAGE.margin+18,y:590,size:16,font:bold,color:C.ink
    });
    drawWrapped(page,regular,'The business passed the core checks in the current BMA Google Visibility model.',PAGE.margin+18,562,11,PAGE.w-PAGE.margin*2-36,C.text,16);
  }else{
    issues.forEach((issue,index)=>{
      page.drawCircle({x:PAGE.margin+18,y:cursor+5,size:15,color:C.lilac});
      page.drawText(String(index+1),{x:PAGE.margin+14,y:cursor,size:10,font:bold,color:C.dark});
      page.drawText(safe(issue.title),{x:PAGE.margin+45,y:cursor+2,size:14,font:bold,color:C.ink});
      let yy=drawWrapped(page,regular,issue.text,PAGE.margin+45,cursor-24,10,PAGE.w-PAGE.margin*2-45,C.text,14);
      yy=drawWrapped(page,bold,issue.recommendation,PAGE.margin+45,yy-4,10,PAGE.w-PAGE.margin*2-45,C.ink,14);
      cursor=yy-34;
    });

    while(issues.length<3){
      issues.push({
        title:'No additional high-priority visibility issue detected',
        text:'The remaining checks did not produce another issue strong enough to prioritise.',
        recommendation:'Protect what is working and focus on the verified opportunities above.'
      });
      const issue=issues[issues.length-1];
      const index=issues.length-1;
      page.drawCircle({x:PAGE.margin+18,y:cursor+5,size:15,color:C.lilac});
      page.drawText(String(index+1),{x:PAGE.margin+14,y:cursor,size:10,font:bold,color:C.dark});
      page.drawText(issue.title,{x:PAGE.margin+45,y:cursor+2,size:13,font:bold,color:C.ink});
      let yy=drawWrapped(page,regular,issue.text,PAGE.margin+45,cursor-24,10,PAGE.w-PAGE.margin*2-45,C.text,14);
      yy=drawWrapped(page,bold,issue.recommendation,PAGE.margin+45,yy-4,10,PAGE.w-PAGE.margin*2-45,C.ink,14);
      cursor=yy-34;
    }
  }
  footer(pdf,page,regular,4);

  // PAGE 5 - wins + 30-day plan
  page=pdf.addPage([PAGE.w,PAGE.h]);
  title(page,bold,regular,'Keep these',"What's already working",'Good visibility foundations are worth protecting while the priorities are improved.');

  cursor=655;
  const wins=(scan.wins||[]).slice(0,3);

  if(wins.length){
    wins.forEach((win,index)=>{
      page.drawRectangle({
        x:PAGE.margin,y:cursor-54,width:PAGE.w-PAGE.margin*2,height:74,
        color:colors[index%colors.length],borderColor:C.line,borderWidth:1
      });
      page.drawText('PASS',{x:PAGE.margin+16,y:cursor,size:8.5,font:bold,color:C.dark});
      page.drawText(safe(win.title),{x:PAGE.margin+58,y:cursor,size:12,font:bold,color:C.ink});
      drawWrapped(page,regular,win.text,PAGE.margin+58,cursor-21,9.5,PAGE.w-PAGE.margin*2-74,C.text,13);
      cursor-=90;
    });
  }else{
    drawWrapped(page,regular,'No positive signal was strong enough to highlight separately. Focus first on the verified priorities in this report.',PAGE.margin,cursor,11,PAGE.w-PAGE.margin*2,C.text,17);
    cursor-=70;
  }

  page.drawText('30-day priority plan',{x:PAGE.margin,y:cursor-8,size:18,font:bold,color:C.ink});
  cursor-=48;

  const planIssues=(scan.topIssues||[]).slice(0,3);
  const weeks=[
    ['Week 1',planIssues[0]||{title:'Confirm the foundations',recommendation:'Verify the Google Business Profile, website details and analytics before making larger changes.'}],
    ['Week 2',planIssues[1]||{title:'Strengthen trust and local relevance',recommendation:'Improve the most relevant customer-facing trust or service-area signals identified in the check.'}],
    ['Week 3',planIssues[2]||{title:'Tighten search and conversion signals',recommendation:'Review SEO, mobile performance and enquiry tracking for any remaining verified gaps.'}],
    ['Week 4',{title:'Measure and recheck',recommendation:'Review the changes, confirm Google profile accuracy and run the Visibility Check again.'}],
  ];

  weeks.forEach(([label,item],index)=>{
    page.drawRectangle({x:PAGE.margin,y:cursor-52,width:78,height:66,color:colors[index%colors.length]});
    page.drawText(label,{x:PAGE.margin+13,y:cursor-19,size:10,font:bold,color:C.dark});
    page.drawText(safe(item.title),{x:PAGE.margin+98,y:cursor,size:12,font:bold,color:C.ink});
    drawWrapped(page,regular,item.recommendation,PAGE.margin+98,cursor-22,9.5,PAGE.w-PAGE.margin*2-98,C.text,14);
    cursor-=92;
  });
  footer(pdf,page,regular,5);

  // PAGE 6 - next step
  page=pdf.addPage([PAGE.w,PAGE.h]);
  page.drawRectangle({x:0,y:0,width:PAGE.w,height:PAGE.h,color:C.dark});
  page.drawText('BUSINESS MARKETING AGENCY',{
    x:PAGE.margin,y:PAGE.h-72,size:10,font:bold,color:rgb(.78,.87,.84)
  });

  drawWrapped(page,bold,'Be easier to find. Start with what matters most.',PAGE.margin,PAGE.h-132,34,PAGE.w-PAGE.margin*2,C.white,39);
  drawWrapped(
    page,regular,
    'BMA helps local businesses improve Google visibility, websites, SEO, advertising, CRM, automation and AI as one connected growth system.',
    PAGE.margin,PAGE.h-245,12,PAGE.w-PAGE.margin*2,rgb(.82,.89,.87),19
  );

  page.drawRectangle({
    x:PAGE.margin,y:370,width:PAGE.w-PAGE.margin*2,height:150,
    color:rgb(.06,.29,.26),borderColor:rgb(.2,.42,.38),borderWidth:1
  });
  page.drawText('Want help with the findings?',{
    x:PAGE.margin+22,y:480,size:18,font:bold,color:C.white
  });
  drawWrapped(
    page,regular,
    'Tell us what you are trying to improve and we will help you work out the most sensible next step.',
    PAGE.margin+22,448,11,PAGE.w-PAGE.margin*2-44,rgb(.84,.91,.89),17
  );

  const label='businessmarketingagency.com.au/contact-us';
  const contactX=PAGE.margin+22,contactY=396,contactSize=12;
  const contactWidth=bold.widthOfTextAtSize(label,contactSize);
  page.drawText(label,{x:contactX,y:contactY,size:contactSize,font:bold,color:C.white});
  page.drawLine({start:{x:contactX,y:contactY-2},end:{x:contactX+contactWidth,y:contactY-2},thickness:.8,color:C.white});
  addUrlLink(pdf,page,contactX,contactY-3,contactWidth,contactSize+5,'https://businessmarketingagency.com.au/contact-us');

  page.drawText('Melbourne, Australia',{
    x:PAGE.margin,y:42,size:9,font:regular,color:rgb(.7,.82,.79)
  });

  return await pdf.save();
}
