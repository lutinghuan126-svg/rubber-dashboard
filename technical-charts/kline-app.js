"use strict";
var DATA={}, chart=null, zoom={start:55,end:100}, legendSelection={};
var MA_PERIODS=[5,10,20,30,60,120];
var MA_COLORS=['#e6a23c','#409eff','#b37feb','#d65a31','#008b8b','#c445a4'];
var NAMES={RU0:'沪胶 RU 主连',NR0:'20号胶 NR 主连',BR0:'丁二烯橡胶 BR 主连'};
var SUBORDER=['VOL','MACD','KDJ','RSI'];
var state={symbol:'RU0',boll:false,sr:true,chan:false,divergence:false,ma:true,srShort:true,subs:{VOL:true,MACD:true,KDJ:false,RSI:false}};
function getSt(){return state;}
function updateButtons(){
 document.querySelectorAll('[data-sym]').forEach(b=>{let on=b.dataset.sym===state.symbol;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});
 document.querySelectorAll('[data-ind]').forEach(b=>{let k=b.dataset.ind;let on=k==='BOLL'?state.boll:k==='SR'?state.sr:k==='SRS'?state.srShort!==false:k==='CHAN'?state.chan:k==='DIV'?state.divergence:k==='MA'?state.ma!==false:state.subs[k];b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',!!on);});
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
 else if(k==='DIV'){state.divergence=!state.divergence;if(state.divergence)state.subs.MACD=true;}
 else{state.subs[k]=!state.subs[k];if(k==='MACD'&&!state.subs.MACD)state.divergence=false;}
 render();
}
function divergenceSeries(result,rows,macdAxis){
 var list=[];
 ['top','bottom'].forEach(function(type){
  var events=result.events.filter(function(e){return e.type===type;});
  var label=type==='top'?'顶背离':'底背离',color=type==='top'?'#c44939':'#087d78';
  [0,macdAxis].forEach(function(axis){
   var isPrice=axis===0;
   list.push({name:label+(isPrice?'·价格':'·柱峰谷'),type:'line',xAxisIndex:axis,yAxisIndex:axis,data:[],symbol:'none',silent:true,
    markLine:{symbol:['circle','circle'],symbolSize:5,silent:true,lineStyle:{color:color,type:'dashed',width:2},label:{show:false},
     data:events.map(function(e){return [{coord:[isPrice?e.from.priceDate:e.from.histDate,isPrice?e.from.price:e.from.hist]},
       {coord:[isPrice?e.to.priceDate:e.to.histDate,isPrice?e.to.price:e.to.hist]}];})}});
   list.push({name:label+'确认'+(isPrice?'·价格':'·柱值'),type:'scatter',xAxisIndex:axis,yAxisIndex:axis,symbol:'diamond',symbolSize:10,z:8,itemStyle:{color:color},
    label:{show:isPrice,position:type==='top'?'top':'bottom',fontSize:10,color:color,formatter:label+'确认'},
    tooltip:{trigger:'item',formatter:function(p){return p.data.explanation;}},
    data:events.map(function(e){
     return {value:[e.confirmedOn,isPrice?rows[e.confirmedIndex][2]:result.histogram[e.confirmedIndex]],
      explanation:label+'（比较MACD柱峰谷，非反转承诺）<br>前段：'+e.from.startDate+'～'+e.from.endDate+'；后段：'+e.to.startDate+'～'+e.to.endDate+
       '<br>价格'+(type==='top'?'高点':'低点')+'：'+e.from.priceDate+' '+e.from.price+' → '+e.to.priceDate+' '+e.to.price+
       '<br>柱'+(type==='top'?'峰':'谷')+'：'+e.from.histDate+' '+e.from.hist.toFixed(4)+' → '+e.to.histDate+' '+e.to.hist.toFixed(4)+
       '<br>确认日：'+e.confirmedOn+' 日K结束后（柱段首次变色/归零）<br>虚线端点为历史定位，不是当时已知信号。'};
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
  if(!rows.length){chart.clear();document.getElementById('divergence-info').hidden=true;document.getElementById('info').textContent='该品种暂无有效数据，请运行更新脚本后刷新。';return;}
  var dates = rows.map(function(r){return r[0];});
  var kdata = rows.map(function(r){return [r[1],r[2],r[3],r[4]];});
  var closes = rows.map(function(r){return r[2];});
  var divergence=st.divergence?macdDivergenceCalc(rows):null;
  var divInfo=document.getElementById('divergence-info');
  divInfo.hidden=!st.divergence;
  if(divergence){divInfo.textContent='MACD背离：已确认顶背离 '+divergence.events.filter(e=>e.type==='top').length+' 处、底背离 '+divergence.events.filter(e=>e.type==='bottom').length+' 处（当前样本）。主图连价格高低点，副图连红绿柱峰谷；菱形在柱段结束确认日。当天K及未结束尾段不确认；不承诺反转。';}
  var dark = document.documentElement.getAttribute('data-theme')==='dark';
  var tc = dark ? '#ccc' : '#555', lc = dark ? '#444' : '#ddd';
  var last = rows[rows.length-1], prev = rows[rows.length-2] || last;
  var chg = last[2]-prev[2], pct = (chg/prev[2]*100).toFixed(2);
  var info = document.getElementById('info');
  info.textContent = NAMES[sym]+'  最新 '+last[2]+'  '+(chg>=0?'+':'')+chg+' ('+(chg>=0?'+':'')+pct+'%)  '+last[0];
  info.style.color = chg>=0 ? '#da3737' : '#2f9e63';
  var subs = SUBORDER.filter(function(k){return st.subs[k];});
  var H = 440 + subs.length*110, priceTop = 44, sliderH = 48, subBlock = 110;
  document.getElementById('chart').style.height=H+'px';
  chart.resize();
  var priceH = H - priceTop - sliderH - subs.length*subBlock - 8;
  var grids = [{left:68,right:24,top:priceTop,height:priceH}];
  var xAxes = [{type:'category',data:dates,boundaryGap:true,axisLine:{lineStyle:{color:lc}},axisLabel:{show:false},min:'dataMin',max:'dataMax'}];
  var yAxes = [{scale:true,splitLine:{lineStyle:{color:lc}},axisLabel:{color:tc}}];
  subs.forEach(function(k,i){
    var top = priceTop + priceH + 12 + i*subBlock;
    grids.push({left:68,right:24,top:top,height:subBlock-30});
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
  var allIdx = xAxes.map(function(_,i){return i;});
  chart.setOption({
    animation:false,
    legend:{type:'scroll',data:legendData,selectedMode:true,selected:Object.fromEntries(Object.entries(legendSelection).filter(function(entry){return legendData.indexOf(entry[0])!==-1;})),top:0,left:68,right:24,textStyle:{color:tc}},
    tooltip:{trigger:'axis', axisPointer:{type:'cross'}},
    axisPointer:{link:[{xAxisIndex:'all'}]},
    grid:grids, xAxis:xAxes, yAxis:yAxes,
    dataZoom:[{type:'inside',xAxisIndex:allIdx,start:zoom.start,end:zoom.end},{type:'slider',xAxisIndex:allIdx,bottom:8,height:20,start:zoom.start,end:zoom.end}],
    graphic:subs.map(function(k,i){return {type:'text',left:72,top:priceTop+priceH+12+i*subBlock,style:{text:k==='VOL'?'成交量（手）':k,fill:tc,fontSize:11}};}),
    series:series
  }, true);

}

async function init(){
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
  window.addEventListener('resize',()=>chart.resize());render();
 }catch(e){status.textContent='加载失败：'+e.message;status.classList.add('error');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
