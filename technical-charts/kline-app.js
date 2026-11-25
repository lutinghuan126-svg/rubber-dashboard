"use strict";
var DATA={}, chart=null, zoom={start:55,end:100}, legendSelection={};
var MA_PERIODS=[5,10,20,30,60,120];
var MA_COLORS=['#e6a23c','#409eff','#b37feb','#d65a31','#008b8b','#c445a4'];
var NAMES={RU0:'沪胶 RU 主连',NR0:'20号胶 NR 主连',BR0:'丁二烯橡胶 BR 主连'};
var SUBORDER=['VOL','MACD','KDJ','RSI'];
var state={symbol:'RU0',boll:false,sr:true,chan:false,divergence:false,ma:true,srShort:true,evr:false,subs:{VOL:true,MACD:true,KDJ:false,RSI:false}};
function getSt(){return state;}
function updateButtons(){
 document.querySelectorAll('[data-sym]').forEach(b=>{let on=b.dataset.sym===state.symbol;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});
 document.querySelectorAll('[data-ind]').forEach(b=>{let k=b.dataset.ind;let on=k==='BOLL'?state.boll:k==='SR'?state.sr:k==='SRS'?state.srShort!==false:k==='CHAN'?state.chan:k==='DIV'?state.divergence:k==='MA'?state.ma!==false:k==='EVR'?state.evr:state.subs[k];b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',!!on);});
}
// Keep the divergence and MACD controls logically consistent.
function switchSymbol(symbol){if(NAMES[symbol]){state.symbol=symbol;render();}}
function rememberLegendSelection(event){
 // Merge so MA selections survive while their series/legend entries are absent.
 Object.assign(legendSelection,event.selected);
}
function rememberZoom(){var z=chart.getOption().dataZoom[0];zoom={start:z.start,end:z.end};}
function toggleIndicator(k){
 if(k==='BOLL')state.boll=!state.boll;
 else if(k==='SR')state.sr=!state.sr;
 else if(k==='SRS')state.srShort=state.srShort===false;
 else if(k==='CHAN')state.chan=!state.chan;
 else if(k==='MA')state.ma=state.ma===false;
 else if(k==='EVR')state.evr=!state.evr;
 else if(k==='DIV'){state.divergence=!state.divergence;if(state.divergence)state.subs.MACD=true;}
 else{state.subs[k]=!state.subs[k];if(k==='MACD'&&!state.subs.MACD)state.divergence=false;}
 render();
}
function divergenceSeries(result,rows,macdAxis){
 var list=[];
 var statusText={active:'早期提示，可能失效',reassessing:'柱峰再扩/等高重访，待再次拐头重评',invalidated:'后续柱峰超前段，已失效（历史保留）',retained:'柱段后来结束，早期条件仍保留'};
 ['top','bottom'].forEach(function(type){
  var events=result.events.filter(function(e){return e.type===type;});
  var label=type==='top'?'顶背离':'底背离',color=type==='top'?'#c44939':'#087d78';
  [0,macdAxis].forEach(function(axis){
   var isPrice=axis===0;
   list.push({name:'早期'+label+(isPrice?'·价格':'·柱峰谷'),type:'line',xAxisIndex:axis,yAxisIndex:axis,data:[],symbol:'none',silent:true,
    markLine:{symbol:['circle','circle'],symbolSize:5,silent:true,lineStyle:{color:color,type:'dashed',width:2},label:{show:false},
     data:events.map(function(e){return [{coord:[isPrice?e.from.priceDate:e.from.histDate,isPrice?e.from.price:e.from.hist],lineStyle:{color:e.status==='invalidated'?'#9299a2':color,opacity:e.status==='invalidated'?0.45:0.85}},
       {coord:[isPrice?e.to.priceDate:e.to.histDate,isPrice?e.to.price:e.to.hist]}];})}});
   list.push({name:'早期'+label+'触发'+(isPrice?'·价格':'·柱值'),type:'scatter',xAxisIndex:axis,yAxisIndex:axis,symbol:'diamond',symbolSize:10,z:8,itemStyle:{color:color},
    label:{show:isPrice,position:type==='top'?'top':'bottom',fontSize:10,color:color},
    tooltip:{trigger:'item',formatter:function(p){return p.data.explanation;}},
    data:events.map(function(e){
     var latest=e.latest,history=e.reviews.map(function(r){return r.on+'：'+r.reason;}).join('<br>');
     return {value:[e.triggeredOn,isPrice?rows[e.triggeredIndex][2]:result.histogram[e.triggeredIndex]],
      itemStyle:{color:e.status==='invalidated'?'#9299a2':e.status==='reassessing'?'#b58119':color},
      label:{formatter:label+(e.status==='invalidated'?'·失效':e.status==='reassessing'?'·待重评':'·早期')},
      explanation:'早期'+label+'（MACD柱峰谷，不是DIF背离或反转承诺）<br>首次触发日：'+e.triggeredOn+' 已完成日K；已观察到柱拐头，不等待快慢线交叉'+
       '<br>当时前段：'+e.from.startDate+'～'+e.from.endDate+'；当时后段：'+e.to.startDate+'～'+e.to.endDate+
       '<br>当时价格'+(type==='top'?'高点':'低点')+'：'+e.from.priceDate+' '+e.from.price+' → '+e.to.priceDate+' '+e.to.price+
       '<br>当时柱'+(type==='top'?'峰':'谷')+'：'+e.from.histDate+' '+e.from.hist.toFixed(4)+' → '+e.to.histDate+' '+e.to.hist.toFixed(4)+
       '<br>截至样本末状态：'+statusText[e.status]+'（'+e.statusOn+'）'+
       '<br>后段目前极值：价格 '+latest.priceDate+' '+latest.price+'；柱 '+latest.histDate+' '+latest.hist.toFixed(4)+
       (history?'<br>后续记录：<br>'+history:'')+
       '<br>连线冻结在首次触发时已知端点；菱形在触发日，不回填到柱峰当天。后续失效不删除历史提示。'};
    })});
  });
 });
 return list;
}
function validate(data){
 for(const sym of ['RU','NR','BR']){
  const rows=data[sym];if(!Array.isArray(rows)||!rows.length||rows.length>250)throw Error(sym+' 数据为空或超过250条');
  let prev='';
  DATA[sym+'0']=rows.map(r=>{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date||r.date<=prev)throw Error(sym+' 日期格式/顺序错误');
   prev=r.date;
   for(const k of ['open','close','low','high','volume'])if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||(k!=='volume'&&r[k]===0))throw Error(sym+' 非法数值');
   if(r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close))throw Error(sym+' OHLC范围错误');
   return [r.date,r.open,r.close,r.low,r.high,r.volume];
  });
 }
}
function render(){
  var st = getSt(), sym = st.symbol, rows = DATA[sym] || [];
  if(st.divergence)st.subs.MACD=true;
  updateButtons();
  if(!rows.length){document.getElementById('evr-panel').hidden=true;chart.clear();document.getElementById('divergence-info').hidden=true;document.getElementById('info').textContent='该品种暂无有效数据，请运行更新脚本后刷新。';return;}
  var dates = rows.map(function(r){return r[0];});
  var kdata = rows.map(function(r){return [r[1],r[2],r[3],r[4]];});
  var closes = rows.map(function(r){return r[2];});
  var divergence=st.divergence?macdDivergenceCalc(rows):null;
  var divInfo=document.getElementById('divergence-info');
  divInfo.hidden=!st.divergence;
  if(divergence){divInfo.textContent='MACD柱拐头早期提示：顶 '+divergence.events.filter(e=>e.type==='top').length+' 处、底 '+divergence.events.filter(e=>e.type==='bottom').length+' 处；已失效 '+divergence.events.filter(e=>e.status==='invalidated').length+'、待重评 '+divergence.events.filter(e=>e.status==='reassessing').length+'（当前样本历史记录）。同色柱首次缩短/收浅即可触发，不等待交叉；当天K不参与。菱形在触发日，连线冻结当时端点，后续状态悬停可查，可能失效、不承诺反转。';}
  // Independent source-available AGProLabs v1.3 frontend module; no fetching.
  var evr=null,evrPanel=document.getElementById('evr-panel');evrPanel.hidden=!st.evr;
  if(st.evr){
   if(typeof AGProEVR==='undefined')evrPanel.textContent='量价顶底模块加载失败，请刷新本地页面；未生成替代信号。';
   else{evr=AGProEVR.calculate(rows,{asOfDate:shanghaiTradingDate(),minTick:5});evrPanel.textContent=AGProEVR.panelText(evr);}
  }
  var dark = document.documentElement.getAttribute('data-theme')==='dark';
  var tc = dark ? '#ccc' : '#555', lc = dark ? '#444' : '#ddd';
  var last = rows[rows.length-1], prev = rows[rows.length-2] || last;
  var chg = last[2]-prev[2], pct = (chg/prev[2]*100).toFixed(2);
  var info = document.getElementById('info');
  info.textContent = NAMES[sym]+'  最新 '+last[2]+'  '+(chg>=0?'+':'')+chg+' ('+(chg>=0?'+':'')+pct+'%)  '+last[0];
  info.style.color = chg>=0 ? '#da3737' : '#2f9e63';
  var subs = SUBORDER.filter(function(k){return st.subs[k];});
  var layout=technicalLayout(subs.length),H=layout.H,priceTop=layout.priceTop,sliderH=layout.sliderH,subBlock=layout.subBlock;
  document.getElementById('chart').style.height=H+'px';
  chart.resize();
  var priceH = H - priceTop - sliderH - subs.length*subBlock - 8;
  var grids = [{left:layout.left,right:layout.right,top:priceTop,height:priceH}];
  var xAxes = [{type:'category',data:dates,boundaryGap:true,axisLine:{lineStyle:{color:lc}},axisLabel:{show:false},min:'dataMin',max:'dataMax'}];
  var yAxes = [{scale:true,splitLine:{lineStyle:{color:lc}},axisLabel:{color:tc}}];
  subs.forEach(function(k,i){
    var top = priceTop + priceH + 12 + i*subBlock;
    grids.push({left:layout.left,right:layout.right,top:top,height:subBlock-30});
    xAxes.push({type:'category',gridIndex:i+1,data:dates,axisLabel:{show: i===subs.length-1, color:tc},axisLine:{lineStyle:{color:lc}},min:'dataMin',max:'dataMax'});
    yAxes.push({gridIndex:i+1,scale:true,axisLabel:{color:tc,fontSize:10},splitLine:{show:false}});
  });
  if(subs.length===0){ xAxes[0].axisLabel = {show:true, color:tc}; }
  var showMA=st.ma!==false;
  var activeMA=showMA?MA_PERIODS:[];
  var legendData = activeMA.map(function(period){return 'MA'+period;});
  var series = [
    {name:NAMES[sym],type:'candlestick',data:kdata,itemStyle:{color:'#da3737',color0:'#2f9e63',borderColor:'#da3737',borderColor0:'#2f9e63'}}
  ].concat(activeMA.map(function(period,i){
    return {name:'MA'+period,type:'line',data:ma(period,closes),smooth:false,symbol:'none',connectNulls:false,
      itemStyle:{color:MA_COLORS[i]},lineStyle:{width:period>=30?1.5:1,color:MA_COLORS[i],type:period===30?'dashed':period===60?'dotted':'solid'}};
  }));
  var srLines=[];
  // Long-term window keeps the original 120-bar sample of whatever rows are loaded.
  if(st.sr){
    var longSR=supportResistanceLevels(rows,120);
    if(longSR.count)srLines.push(
      {yAxis:longSR.high, lineStyle:{color:'#da3737', type:'dashed', width:1}, label:{show:true, position:'insideEndTop', color:'#da3737', fontSize:11, formatter:'压力 '+longSR.high}},
      {yAxis:longSR.mid, lineStyle:{color:'#909399', type:'dashed', width:1}, label:{show:true, position:'insideEndTop', color:'#909399', fontSize:11, formatter:'中轴 '+longSR.mid}},
      {yAxis:longSR.low, lineStyle:{color:'#2f9e63', type:'dashed', width:1}, label:{show:true, position:'insideEndBottom', color:'#2f9e63', fontSize:11, formatter:'支撑 '+longSR.low}}
    );
  }
  // Short-term uses the latest 20 completed Shanghai-session days, not the zoom window.
  if(st.srShort!==false){
    var shortSR=supportResistanceLevels(rows,20,{asOfDate:shanghaiTradingDate()});
    if(shortSR.count)srLines.push(
      {yAxis:shortSR.high, lineStyle:{color:'#c2410c', type:'dotted', width:1.5}, label:{show:true, position:'insideStartTop', color:'#c2410c', fontSize:11, formatter:'短期压力 '+shortSR.high}},
      {yAxis:shortSR.mid, lineStyle:{color:'#4338ca', type:'dotted', width:1.5}, label:{show:true, position:'insideStartTop', color:'#4338ca', fontSize:11, formatter:'短期中轴 '+shortSR.mid}},
      {yAxis:shortSR.low, lineStyle:{color:'#0e7490', type:'dotted', width:1.5}, label:{show:true, position:'insideStartBottom', color:'#0e7490', fontSize:11, formatter:'短期支撑 '+shortSR.low}}
    );
  }
  if(srLines.length)series[0].markLine={symbol:'none', silent:true, animation:false, data:srLines};
  if(st.boll){
    var b = bollCalc(closes);
    legendData.push('BOLL上','BOLL中','BOLL下');
    series.push({name:'BOLL上',type:'line',data:b.up,symbol:'none',lineStyle:{width:1,color:'#909399',type:'dashed'}});
    series.push({name:'BOLL中',type:'line',data:b.mb,symbol:'none',lineStyle:{width:1,color:'#909399',type:'dotted'}});
    series.push({name:'BOLL下',type:'line',data:b.dn,symbol:'none',lineStyle:{width:1,color:'#909399',type:'dashed'}});
  }
  subs.forEach(function(k,i){
    var xi = i+1;
    if(k==='VOL'){
      series.push({name:'成交量',type:'bar',xAxisIndex:xi,yAxisIndex:xi,data:rows.map(function(r){return {value:r[5],itemStyle:{color:r[2]>=r[1]?'#da3737':'#2f9e63'}};})});
    } else if(k==='MACD'){
      var m = macdRaw(closes);
      series.push({name:'DIF',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:m.dif,symbol:'none',lineStyle:{width:1,color:'#e6a23c'}});
      series.push({name:'DEA',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:m.dea,symbol:'none',lineStyle:{width:1,color:'#409eff'}});
      series.push({name:'MACD',type:'bar',xAxisIndex:xi,yAxisIndex:xi,data:m.bar.map(function(v){return {value:v,itemStyle:{color:v>=0?'#da3737':'#2f9e63'}};})});
    } else if(k==='KDJ'){
      var kd = kdjCalc(rows);
      series.push({name:'K',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:kd.k,symbol:'none',lineStyle:{width:1,color:'#e6a23c'}});
      series.push({name:'D',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:kd.d,symbol:'none',lineStyle:{width:1,color:'#409eff'}});
      series.push({name:'J',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:kd.j,symbol:'none',lineStyle:{width:1,color:'#f56c6c'}});
    } else if(k==='RSI'){
      series.push({name:'RSI6',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:rsiCalc(closes,6),symbol:'none',lineStyle:{width:1,color:'#e6a23c'}});
      series.push({name:'RSI12',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:rsiCalc(closes,12),symbol:'none',lineStyle:{width:1,color:'#409eff'}});
      series.push({name:'RSI24',type:'line',xAxisIndex:xi,yAxisIndex:xi,data:rsiCalc(closes,24),symbol:'none',lineStyle:{width:1,color:'#b37feb'}});
    }
  });
  if(st.chan){
    var cl = chanlunCalc(rows);
    legendData.push('缠论笔');
    series.push({name:'缠论笔', type:'line', data:cl.line, symbol:'circle', symbolSize:5, lineStyle:{width:2, color:'#f5c518'}, itemStyle:{color:'#f5c518'}});
    if(cl.areas.length){
      series[0].markArea = {silent:true, data: cl.areas.map(function(a){ return [{xAxis:a.x1, yAxis:a.zg, itemStyle:{color:'rgba(245,197,24,0.13)'}}, {xAxis:a.x2, yAxis:a.zd}]; })};
    }
  }
  if(divergence)series=series.concat(divergenceSeries(divergence,rows,subs.indexOf('MACD')+1));
  if(evr)series=series.concat(AGProEVR.series(evr));
  var allIdx = xAxes.map(function(_,i){return i;});
  chart.setOption({
    animation:false,
    legend:{type:'scroll',data:legendData,selectedMode:true,selected:Object.fromEntries(Object.entries(legendSelection).filter(function(entry){return legendData.indexOf(entry[0])!==-1;})),top:0,left:layout.left,right:layout.right,textStyle:{color:tc}},
    tooltip:{trigger:'axis', axisPointer:{type:'cross'},formatter:evr?function(params){return AGProEVR.axisTooltip(params,evr,rows);}:undefined},
    axisPointer:{link:[{xAxisIndex:'all'}]},
    grid:grids, xAxis:xAxes, yAxis:yAxes,
    dataZoom:[{type:'inside',xAxisIndex:allIdx,start:zoom.start,end:zoom.end},{type:'slider',xAxisIndex:allIdx,bottom:8,height:20,start:zoom.start,end:zoom.end}],
    graphic:subs.map(function(k,i){return {type:'text',left:layout.left+4,top:priceTop+priceH+12+i*subBlock,style:{text:k==='VOL'?'成交量（手）':k,fill:tc,fontSize:11}};}),
    series:series
  }, true);

}

// View-only controller. Never reparents the iframe or resets chart/indicator state.
var technicalView={mode:null,native:false,version:0,snapshot:null,bound:false,resizeQueued:false};
function technicalLayout(count){
 if(!technicalView.mode)return {H:440+count*110,priceTop:44,sliderH:48,subBlock:110,left:68,right:24};
 var mobile=technicalView.mode==='mobile',host=document.getElementById('chart-scroll');
 var vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||700;
 var available=Math.max(220,Math.floor((host&&host.clientHeight)||vh-136));
 var subBlock=mobile?(available<420?64:88):100,priceTop=30,sliderH=44;
 var minimum=mobile?140:200;
 return {H:Math.max(available,priceTop+sliderH+8+minimum+count*subBlock),priceTop:priceTop,sliderH:sliderH,subBlock:subBlock,left:mobile?48:68,right:mobile?12:24};
}
function technicalFullscreenOwned(){return document.fullscreenElement===document.documentElement;}
function syncTechnicalView(){
 var active=!!technicalView.mode||technicalFullscreenOwned();
 ['desktop','mobile'].forEach(function(mode){var e=document.getElementById(mode==='desktop'?'technical-fullscreen':'technical-mobile-fullscreen');if(e){e.setAttribute('aria-pressed',String(technicalView.mode===mode));e.classList.toggle('on',technicalView.mode===mode);}});
 var exit=document.getElementById('technical-exit-fullscreen'),hint=document.getElementById('technical-view-hint');
 if(exit)exit.hidden=!active;
 if(hint){hint.hidden=!active;hint.textContent=(technicalFullscreenOwned()?'已进入浏览器全屏':'视口铺满（未进入系统全屏）')+(technicalView.mode==='mobile'?'；手机触控布局，不强制旋转，可手动横置；副图较多时在图内上下滑动。':'；可点「退出全屏」或按 Esc 返回。');}
}
function scheduleTechnicalResize(){
 if(technicalView.resizeQueued)return;technicalView.resizeQueued=true;
 (window.requestAnimationFrame||function(fn){return setTimeout(fn,0);})(function(){technicalView.resizeQueued=false;if(chart){if(technicalView.mode)render();else chart.resize();}});
}
function technicalEscape(event){if(event.key==='Escape'&&(technicalView.mode||technicalFullscreenOwned())){event.preventDefault();exitTechnicalView();}}
function openTechnicalOverlay(){
 var snap={bodyOverflow:document.body.style.overflow,rootOverflow:document.documentElement.style.overflow,x:window.scrollX||0,y:window.scrollY||0,focus:document.activeElement,frame:null};
 try{
  var frame=window.frameElement;
  if(frame&&frame.ownerDocument&&frame.ownerDocument.body){
   var pd=frame.ownerDocument,pw=pd.defaultView;
   snap.frame={element:frame,css:frame.style.cssText,document:pd,window:pw,bodyOverflow:pd.body.style.overflow,rootOverflow:pd.documentElement.style.overflow,x:pw.scrollX||0,y:pw.scrollY||0};
   // Same-origin own frame only. Keep it in place: moving iframes would reload state.
   Object.assign(frame.style,{position:'fixed',top:'0',left:'0',right:'0',bottom:'0',width:'100vw',height:'100vh',maxWidth:'none',maxHeight:'none',margin:'0',border:'0',zIndex:'2147483646',display:'block'});
   frame.style.height='100dvh';pd.body.style.overflow='hidden';pd.documentElement.style.overflow='hidden';pd.addEventListener('keydown',technicalEscape);
  }
 }catch(error){/* Cross-origin embedding may only fill its own iframe viewport. */}
 document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';technicalView.snapshot=snap;
}
function restoreTechnicalOverlay(){
 var snap=technicalView.snapshot;technicalView.snapshot=null;if(!snap)return;
 document.body.style.overflow=snap.bodyOverflow;document.documentElement.style.overflow=snap.rootOverflow;
 if(snap.frame){try{var f=snap.frame;f.element.style.cssText=f.css;f.document.body.style.overflow=f.bodyOverflow;f.document.documentElement.style.overflow=f.rootOverflow;f.document.removeEventListener('keydown',technicalEscape);f.window.scrollTo(f.x,f.y);}catch(error){}}
 window.scrollTo(snap.x,snap.y);
 if(snap.focus&&snap.focus.isConnected&&snap.focus.focus)snap.focus.focus({preventScroll:true});
}
function applyTechnicalMode(mode){
 technicalView.mode=mode;document.body.classList.toggle('technical-expanded',!!mode);document.body.classList.toggle('technical-mobile',mode==='mobile');syncTechnicalView();if(chart)render();
}
async function exitTechnicalView(requestNative){
 technicalView.version++;technicalView.mode=null;technicalView.native=false;
 document.body.classList.remove('technical-expanded','technical-mobile');restoreTechnicalOverlay();syncTechnicalView();if(chart)render();
 if(requestNative!==false&&technicalFullscreenOwned()&&document.exitFullscreen){
  try{await document.exitFullscreen();}catch(error){var h=document.getElementById('technical-view-hint');h.hidden=false;h.textContent='浏览器尚未退出系统全屏，请按 Esc 或再次点「退出全屏」。';document.getElementById('technical-exit-fullscreen').hidden=false;}
 }
 scheduleTechnicalResize();
}
async function toggleTechnicalView(mode){
 if(mode!== 'desktop'&&mode!=='mobile')return;
 if(technicalView.mode===mode){await exitTechnicalView();return;}
 if(technicalView.mode){applyTechnicalMode(mode);scheduleTechnicalResize();return;}
 var version=++technicalView.version;openTechnicalOverlay();applyTechnicalMode(mode);
 var exit=document.getElementById('technical-exit-fullscreen');if(exit)exit.focus({preventScroll:true});
 var root=document.documentElement;
 if(document.fullscreenEnabled!==false&&root.requestFullscreen){
  try{
   await root.requestFullscreen();
   if(version!==technicalView.version||!technicalView.mode){if(technicalFullscreenOwned()&&document.exitFullscreen)await document.exitFullscreen();return;}
   technicalView.native=technicalFullscreenOwned();
  }catch(error){/* Permission/API failure keeps the explicitly labelled viewport fallback. */}
 }
 syncTechnicalView();scheduleTechnicalResize();
}
function setupTechnicalView(){
 if(technicalView.bound)return;technicalView.bound=true;
 [['technical-fullscreen','desktop'],['technical-mobile-fullscreen','mobile']].forEach(function(pair){var e=document.getElementById(pair[0]);if(e)e.addEventListener('click',function(){toggleTechnicalView(pair[1]);});});
 var exit=document.getElementById('technical-exit-fullscreen');if(exit)exit.addEventListener('click',function(){exitTechnicalView();});
 document.addEventListener('keydown',technicalEscape);
 document.addEventListener('fullscreenchange',function(){var owned=technicalFullscreenOwned();if(technicalView.mode&&technicalView.native&&!owned){exitTechnicalView(false);return;}technicalView.native=owned;syncTechnicalView();scheduleTechnicalResize();});
 window.addEventListener('resize',scheduleTechnicalResize);window.addEventListener('orientationchange',scheduleTechnicalResize);
 window.addEventListener('pagehide',function(){exitTechnicalView(false);});
 if(window.visualViewport)window.visualViewport.addEventListener('resize',scheduleTechnicalResize);
 syncTechnicalView();
}

async function init(){
 setupTechnicalView();
 const status=document.getElementById('status');
 try{
  if(typeof echarts==='undefined')throw Error('本地 ECharts 资源未加载，请完整解压压缩包');
  let data,meta;
  if(window.__KLINE_EMBEDDED__){data=window.__KLINE_EMBEDDED__.data;meta=window.__KLINE_EMBEDDED__.meta;}
  else{
   if(location.protocol==='file:')throw Error('标准版需通过本地HTTP服务打开，或直接双击 offline-preview.html');
   const r=await fetch('data/kline.json',{cache:'no-store'});if(!r.ok)throw Error('kline.json HTTP '+r.status);
   const text=await r.text();data=JSON.parse(text);
   try{
    const m=await fetch('data/kline-meta.json',{cache:'no-store'});if(!m.ok)throw Error('元数据缺失');meta=await m.json();
    if(!crypto.subtle)throw Error('当前环境不能校验获取时间');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==meta.sha256)throw Error('元数据与JSON不一致');
   }catch(e){meta=null;}
  }
  validate(data);
  status.textContent=meta?'真实接口数据 · 获取时间 '+new Date(meta.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' 北京时间 · 日K可能尚未最终结算':'数据已加载；获取时间无法校验，请检查元数据或重新更新。';
  chart=echarts.init(document.getElementById('chart'));
  chart.on('datazoom',rememberZoom);
  chart.on('legendselectchanged',rememberLegendSelection);
  document.querySelectorAll('[data-sym]').forEach(b=>b.addEventListener('click',()=>switchSymbol(b.dataset.sym)));
  document.querySelectorAll('[data-ind]').forEach(b=>b.addEventListener('click',()=>toggleIndicator(b.dataset.ind)));
  render();
 }catch(e){status.textContent='加载失败：'+e.message;status.classList.add('error');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
