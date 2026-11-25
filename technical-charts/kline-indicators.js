function ma(day, closes){var r=[];for(var i=0;i<closes.length;i++){if(i<day-1){r.push('-');continue;}var s=0;for(var j=0;j<day;j++)s+=closes[i-j];r.push(+(s/day).toFixed(2));}return r;}
function emaArr(n, arr){var r=[],k=2/(n+1);for(var i=0;i<arr.length;i++){r.push(i===0?arr[0]:arr[i]*k+r[i-1]*(1-k));}return r;}
function macdCalc(closes){var e12=emaArr(12,closes),e26=emaArr(26,closes),dif=closes.map(function(_,i){return e12[i]-e26[i];});var dea=emaArr(9,dif);function f(a){return a.map(function(x){return +x.toFixed(2);});}return{dif:f(dif),dea:f(dea),bar:f(dif.map(function(d,i){return 2*(d-dea[i]);}))};}
function bollCalc(closes){var up=[],dn=[],mb=ma(20,closes);for(var i=0;i<closes.length;i++){if(i<19){up.push('-');dn.push('-');continue;}var s=0;for(var j=0;j<20;j++)s+=closes[i-j];var m=s/20,v=0;for(var j=0;j<20;j++)v+=Math.pow(closes[i-j]-m,2);var sd=Math.sqrt(v/20);up.push(+(m+2*sd).toFixed(2));dn.push(+(m-2*sd).toFixed(2));}return{up:up,mb:mb,dn:dn};}
function kdjCalc(rows){var K=[],D=[],J=[],k=50,d=50;for(var i=0;i<rows.length;i++){var lo=Infinity,hi=-Infinity;for(var j=Math.max(0,i-8);j<=i;j++){lo=Math.min(lo,rows[j][3]);hi=Math.max(hi,rows[j][4]);}var rsv=hi===lo?50:(rows[i][2]-lo)/(hi-lo)*100;k=2/3*k+1/3*rsv;d=2/3*d+1/3*k;K.push(+k.toFixed(2));D.push(+d.toFixed(2));J.push(+(3*k-2*d).toFixed(2));}return{k:K,d:D,j:J};}
function rsiCalc(closes, n){var r=[],g=0,l=0;for(var i=0;i<closes.length;i++){if(i===0){r.push('-');continue;}var ch=closes[i]-closes[i-1],up=Math.max(ch,0),dn=Math.max(-ch,0);if(i<=n){g+=up/n;l+=dn/n;if(i<n){r.push('-');continue;}}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n;}r.push(l===0?(g===0?50:100):+(100-100/(1+g/l)).toFixed(2));}return r;}

function supportResistanceLevels(rows, lookback, options){
  options=options||{};
  if(!Number.isInteger(lookback)||lookback<1)throw Error('Invalid support/resistance lookback');
  var asOf=options.asOfDate;
  var sample=rows;
  if(asOf){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('Invalid as-of date');
    sample=rows.filter(function(r){return r[0]<asOf;});
  }
  if(!sample.length)return {count:0,high:null,low:null,mid:null,startDate:null,endDate:null};
  var win=sample.slice(-lookback), hi=-Infinity, lo=Infinity;
  for(var i=0;i<win.length;i++){
    if(!Number.isFinite(win[i][3])||!Number.isFinite(win[i][4]))throw Error('Invalid OHLC in support/resistance window');
    if(win[i][4]>hi)hi=win[i][4];
    if(win[i][3]<lo)lo=win[i][3];
  }
  return {count:win.length,high:hi,low:lo,mid:(hi+lo)/2,startDate:win[0][0],endDate:win[win.length-1][0]};
}

function chanlunCalc(rows){
  var mg = [];
  function pushBar(b){ mg.push({h:b[4], l:b[3], dH:b[0], dL:b[0]}); }
  for(var i=0;i<rows.length;i++){
    var b = rows[i];
    if(mg.length===0){ pushBar(b); continue; }
    var last = mg[mg.length-1];
    var incl = (b[4]>=last.h && b[3]<=last.l) || (b[4]<=last.h && b[3]>=last.l);
    if(!incl){ pushBar(b); continue; }
    var up;
    if(mg.length>=2){ up = last.h >= mg[mg.length-2].h; }
    else { up = (b[4]+b[3]) >= (last.h+last.l); }
    if(up){
      if(b[4]>last.h){ last.h=b[4]; last.dH=b[0]; }
      if(b[3]>last.l){ last.l=b[3]; last.dL=b[0]; }
    } else {
      if(b[4]<last.h){ last.h=b[4]; last.dH=b[0]; }
      if(b[3]<last.l){ last.l=b[3]; last.dL=b[0]; }
    }
  }
  var fr = [];
  for(var i=1;i<mg.length-1;i++){
    var a=mg[i-1], c=mg[i], n=mg[i+1];
    if(c.h>a.h && c.h>n.h && c.l>a.l && c.l>n.l){ fr.push({t:'top', idx:i, p:c.h, d:c.dH}); }
    else if(c.h<a.h && c.h<n.h && c.l<a.l && c.l<n.l){ fr.push({t:'bot', idx:i, p:c.l, d:c.dL}); }
  }
  var pts = [];
  for(var i=0;i<fr.length;i++){
    var f = fr[i];
    if(pts.length===0){ pts.push(f); continue; }
    var lp = pts[pts.length-1];
    if(f.t===lp.t){
      if((f.t==='top' && f.p>lp.p) || (f.t==='bot' && f.p<lp.p)){ pts[pts.length-1]=f; }
    } else if(f.idx - lp.idx >= 4 && ((f.t==='top' && f.p>lp.p) || (f.t==='bot' && f.p<lp.p))){ pts.push(f); }
  }
  var line = pts.map(function(p){ return [p.d, p.p]; });
  var areas = centers(pts);
  return {line:line, areas:areas, merged:mg, fractals:fr, points:pts};
}
function centers(pts){
  var areas = [];
  if(pts.length>=4){
    var strokes = [];
    for(var i=0;i<pts.length-1;i++){ strokes.push({hi:Math.max(pts[i].p, pts[i+1].p), lo:Math.min(pts[i].p, pts[i+1].p), d1:pts[i].d, d2:pts[i+1].d}); }
    var i=0;
    while(i+2<strokes.length){
      var zg = Math.min(strokes[i].hi, strokes[i+1].hi, strokes[i+2].hi);
      var zd = Math.max(strokes[i].lo, strokes[i+1].lo, strokes[i+2].lo);
      if(zd<zg){
        var endD = strokes[i+2].d2, j=i+3;
        while(j<strokes.length && strokes[j].lo<zg && strokes[j].hi>zd){ endD = strokes[j].d2; j++; }
        areas.push({x1:strokes[i].d1, x2:endD, zg:zg, zd:zd});
        i = j;
      } else { i++; }
    }
  }
  return areas;
}

if(typeof module!=="undefined") module.exports={ma,emaArr,macdCalc,bollCalc,kdjCalc,rsiCalc,chanlunCalc,centers,supportResistanceLevels};

// MACD histogram wave divergence. Kept separate from simplified Chan logic.
function shanghaiTradingDate(now){
  var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now||new Date());
  var values={};parts.forEach(function(p){values[p.type]=p.value;});
  return values.year+'-'+values.month+'-'+values.day;
}
function macdRaw(closes){
  var fast=emaArr(12,closes),slow=emaArr(26,closes);
  var dif=fast.map(function(v,i){return v-slow[i];}),dea=emaArr(9,dif);
  return {dif:dif,dea:dea,bar:dif.map(function(v,i){return 2*(v-dea[i]);})};
}
function detectMacdDivergence(rows,histogram,options){
  options=options||{};
  var warmup=options.warmup===undefined?26:options.warmup;
  var asOf=options.asOfDate||shanghaiTradingDate();
  if(!Number.isInteger(warmup)||warmup<0)throw Error('Invalid histogram warmup');
  if(histogram.length!==rows.length)throw Error('Histogram length mismatch');
  rows.forEach(function(row,i){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row[0])||(i&&row[0]<=rows[i-1][0])||!Number.isFinite(histogram[i])||!Number.isFinite(row[3])||!Number.isFinite(row[4]))throw Error('Invalid/duplicate histogram bar');
  });
  var closed=rows.filter(function(r){return r[0]<asOf;}).length;
  var segments=[],events=[],previous={1:null,'-1':null},active=null;
  function greater(a,b){return a-b>1e-9*Math.max(1,Math.abs(a),Math.abs(b));}
  function sign(v){return Math.abs(v)<=1e-10?0:v>0?1:-1;}
  function snapshot(s){
    var out={};['sign','startIndex','startDate','endIndex','endDate','priceIndex','priceDate','price','histIndex','histDate','hist','eligible','turned'].forEach(function(k){out[k]=s[k];});return out;
  }
  function begin(i,color){
    return {sign:color,startIndex:i,startDate:rows[i][0],endIndex:i,endDate:rows[i][0],
      priceIndex:i,priceDate:rows[i][0],price:rows[i][color>0?4:3],
      histIndex:i,histDate:rows[i][0],hist:histogram[i],turned:false,eventIndex:null,
      eligible:i>0&&i>=warmup-1};
  }
  function extend(s,i){
    s.endIndex=i;s.endDate=rows[i][0];
    var price=rows[i][s.sign>0?4:3],priceChanged=s.sign>0?greater(price,s.price):greater(s.price,price);
    if(priceChanged){s.price=price;s.priceIndex=i;s.priceDate=rows[i][0];}
    var strength=s.sign*histogram[i],oldPeak=s.sign*s.hist,prevStrength=s.sign*histogram[i-1];
    var stronger=greater(strength,prevStrength),peakReopened=stronger&&!greater(oldPeak,strength);
    if(greater(strength,oldPeak)){s.hist=histogram[i];s.histIndex=i;s.histDate=rows[i][0];}
    // Equal peak plateaus keep their FIRST date. Equal bars alone do not turn.
    if(peakReopened)s.turned=false;
    if(greater(prevStrength,strength))s.turned=true;
    return {priceChanged:priceChanged,peakReopened:peakReopened};
  }
  function review(e,s,i,kind,status,reason){
    e.status=status;e.statusOn=rows[i][0];e.latest=snapshot(s);
    e.reviews.push({index:i,on:rows[i][0],kind:kind,status:status,reason:reason,point:snapshot(s)});
    if(status==='invalidated'){e.invalidatedOn=rows[i][0];e.invalidatedIndex=i;}
  }
  function evaluate(s,i,changes){
    var prev=previous[s.sign];if(!s.eligible||!prev||!prev.eligible)return;
    var top=s.sign>0,priceNew=top?greater(s.price,prev.price):greater(prev.price,s.price);
    var weaker=top?!greater(s.hist,prev.hist):!greater(prev.hist,s.hist);
    var e=s.eventIndex===null?null:events[s.eventIndex];
    if(e)e.latest=snapshot(s);
    // Never delete an early historical signal after a later extension invalidates it.
    if(e&&e.status==='invalidated')return;
    if(!weaker){if(e)review(e,s,i,'invalidation','invalidated','同段柱峰扩大超过前段，早期提示失效');return;}
    if(e&&changes.peakReopened)review(e,s,i,'expansion','reassessing','柱峰扩大或重访等高峰，等待再次拐头重评');
    if(e&&changes.priceChanged)review(e,s,i,'price',e.status,'同段价格产生新极值；原触发点与连线保留');
    if(!s.turned||!priceNew)return;
    if(!e){
      s.eventIndex=events.length;
      events.push({id:(top?'top':'bottom')+'-'+s.startDate,type:top?'top':'bottom',from:snapshot(prev),to:snapshot(s),
        triggeredIndex:i,triggeredOn:rows[i][0],confirmedIndex:i,confirmedOn:rows[i][0],
        status:'active',statusOn:rows[i][0],latest:snapshot(s),reviews:[]});
    }else if(e.status==='reassessing')review(e,s,i,'turn','active','已再次拐头，按当时柱峰及价格重评仍成立');
  }
  function finish(i){
    // If a wave jumps directly across zero, that boundary is its first observable
    // weakening bar; normally the SAME-color contraction has already triggered.
    active.turned=true;evaluate(active,i,{priceChanged:false,peakReopened:false});
    if(active.eventIndex!==null){var e=events[active.eventIndex];if(e.status!=='invalidated')review(e,active,i,'end','retained','后续柱段已结束，早期提示条件仍保留；并非反转保证');}
    var done=snapshot(active);done.endedOn=rows[i][0];segments.push(done);previous[active.sign]=done;active=null;
  }
  for(var i=0;i<closed;i++){
    var color=sign(histogram[i]);
    if(active&&color!==active.sign)finish(i);
    if(!active&&color)active=begin(i,color);
    else if(active)evaluate(active,i,extend(active,i));
  }
  return {events:events,segments:segments,pendingSegment:active?snapshot(active):null,closedBars:closed,
    warmup:warmup,asOfDate:asOf,histogram:histogram.slice()};
}
function macdDivergenceCalc(rows,options){
  var histogram=macdRaw(rows.map(function(r){return r[2];})).bar;
  return detectMacdDivergence(rows,histogram,options);
}
if(typeof module!=="undefined")Object.assign(module.exports,{shanghaiTradingDate:shanghaiTradingDate,macdRaw:macdRaw,detectMacdDivergence:detectMacdDivergence,macdDivergenceCalc:macdDivergenceCalc});
