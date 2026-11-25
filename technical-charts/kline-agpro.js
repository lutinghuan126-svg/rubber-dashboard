/*
 * Effort vs Result Reaction Map [AGPro Series], AGProLabs, v1.3.
 * Frontend JavaScript port, 2026-11-25; original/source/licensing: vendor/NOTICE-AGPRO.txt.
 * https://www.tradingview.com/script/HeDQBrkV-Effort-vs-Result-Reaction-Map-AGPro-Series/
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://mozilla.org/MPL/2.0/.
 * Engine order/defaults follow the original Pine, NOT its occasionally inconsistent tooltips.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AGProEVR=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULTS=Object.freeze({confirmOnClose:true,effortLen:34,atrLen:14,progressBars:3,volumeWeight:0.65,
  highEffortThreshold:1.55,lowEffortThreshold:0.78,poorResultThreshold:38,strongResultThreshold:72,strongProgressAtr:1.15,
  minConfidence:76,cooldownBars:40,reactionWindow:14,reactionTargetAtr:0.75,
  showBoxes:true,boxMinConfidence:80,boxExtendBars:32,boxAtrPad:0.10,boxTransparency:88,
  showLabels:true,showLabelConfidence:true,maxEventLabels:12,labelOffsetAtr:1.15,labelBackgroundTransparency:10,labelSizeInput:'Normal',showMarkers:false,
  showPanel:true,panelPositionInput:'Top Right',panelThemeInput:'Elite Dark',panelFontSizeInput:'Normal'});
 const COLORS=Object.freeze({bull:'#22c5a6',bear:'#f472b6',neutral:'#f5bd5c',accent:'#818cf8'});
 const finite=v=>typeof v==='number'&&Number.isFinite(v),clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
 // Pine ta.sma/ta.rma: na values ignored; require length valid samples to seed.
 function sma(values,length){if(!Number.isInteger(length)||length<1)throw Error('SMA length');let q=[],sum=0;return values.map(v=>{if(finite(v)){q.push(v);sum+=v;if(q.length>length)sum-=q.shift();}return q.length===length?sum/length:NaN;});}
 function rma(values,length){if(!Number.isInteger(length)||length<1)throw Error('RMA length');let count=0,sum=0,previous=NaN,alpha=1/length;return values.map(v=>{if(finite(v)){if(!finite(previous)){count++;sum+=v;if(count===length)previous=sum/length;}else previous=alpha*v+(1-alpha)*previous;}return previous;});}
 function validRows(rows){if(!Array.isArray(rows))throw Error('AGPro rows must be array');let prev='';rows.forEach(r=>{
  if(!Array.isArray(r)||!/^\d{4}-\d{2}-\d{2}$/.test(r[0])||!Number.isFinite(Date.parse(r[0]+'T00:00:00Z'))||new Date(r[0]+'T00:00:00Z').toISOString().slice(0,10)!==r[0]||r[0]<=prev)throw Error('AGPro invalid/duplicate/unsorted date');prev=r[0];
  if(![r[1],r[2],r[3],r[4]].every(finite)||r[3]>Math.min(r[1],r[2])||r[4]<Math.max(r[1],r[2]))throw Error('AGPro invalid OHLC');
  if(r[5]!=null&&(!finite(r[5])||r[5]<0))throw Error('AGPro invalid volume');
 });}
 function calculate(input,options){
  options=options||{};const p=Object.assign({},DEFAULTS,options.inputs||{});validRows(input);
  for(const k of ['effortLen','atrLen','progressBars','reactionWindow','maxEventLabels'])if(!Number.isInteger(p[k])||p[k]<1)throw Error('AGPro invalid '+k);
  for(const k of ['highEffortThreshold','strongProgressAtr','reactionTargetAtr'])if(!finite(p[k])||p[k]<=0)throw Error('AGPro invalid '+k);
  const minTick=options.minTick===undefined?5:options.minTick;if(!finite(minTick)||minTick<=0)throw Error('AGPro invalid mintick');
  // Daily JSON does not identify final intraday close. App supplies asOfDate, excludes today.
  const rows=options.asOfDate?input.filter(r=>r[0]<options.asOfDate):input.slice();
  if(options.confirmed&&options.confirmed.length!==rows.length)throw Error('AGPro confirmed mask length');
  if(options.confirmed&&options.confirmed.slice(0,-1).some(v=>!v))throw Error('Only final live bar may be unconfirmed');
  const tr=rows.map((r,i)=>i?Math.max(r[4]-r[3],Math.abs(r[4]-rows[i-1][2]),Math.abs(r[3]-rows[i-1][2])):r[4]-r[3]);
  const atrs=rma(tr,p.atrLen),volumes=rows.map(r=>r[5]==null?0:r[5]),averages=sma(volumes,p.effortLen);
  let lastAccepted=null,activeBox=null,rrTotal=0,rrWon=0,pending=null;const events=[],labels=[],bars=[],proofs=[];
  rows.forEach((r,i)=>{
   const [date,open,close,low,high]=r,isConfirmed=options.confirmed?!!options.confirmed[i]:true;
   const atr=atrs[i],trueRange=tr[i],safeAtr=Math.max(finite(atr)?atr:trueRange,minTick),barRange=Math.max(high-low,minTick),safeVolume=volumes[i],avgVolume=averages[i];
   const relVolume=avgVolume>0?safeVolume/avgVolume:1,spreadAtr=safeAtr>0?trueRange/safeAtr:0;
   const effortRaw=relVolume*p.volumeWeight+spreadAtr*(1-p.volumeWeight),effortScore=clamp(effortRaw/p.highEffortThreshold*100,0,150);
   const hasProgressHistory=i>=p.progressBars,prior=hasProgressHistory?rows[i-p.progressBars][2]:NaN,rawProgress=hasProgressHistory?Math.abs(close-prior)/safeAtr:0;
   let progressDir=close>=open?1:-1;if(hasProgressHistory){if(close>prior)progressDir=1;else if(close<prior)progressDir=-1;}
   const closeLocation=clamp((close-low)/barRange,0,1),directionalCloseScore=progressDir===1?closeLocation*100:(1-closeLocation)*100;
   const progressScore=clamp(rawProgress/p.strongProgressAtr*100,0,130),resultScore=clamp(progressScore*0.62+directionalCloseScore*0.38,0,100),efficiencyScore=effortScore>0?clamp(resultScore/effortScore*100,0,220):0;
   const upperWick=high-Math.max(open,close),lowerWick=Math.min(open,close)-low,wickBalance=barRange>0?(upperWick-lowerWick)/barRange:0;
   const candleDir=close>open?1:close<open?-1:progressDir;let attemptDir=candleDir;if(Math.abs(wickBalance)>=0.18)attemptDir=wickBalance>0?1:-1;
   const enoughHistory=i>Math.max(p.effortLen,p.atrLen)+p.progressBars,highEffort=effortRaw>=p.highEffortThreshold,lowEffort=effortRaw<=p.lowEffortThreshold,poorResult=resultScore<=p.poorResultThreshold,strongResult=resultScore>=p.strongResultThreshold;
   const failedProgress=enoughHistory&&highEffort&&poorResult,lowEffortProgress=enoughHistory&&lowEffort&&strongResult;
   const failedConfidence=clamp(effortScore*0.50+(100-resultScore)*0.35+Math.abs(wickBalance)*100*0.15,0,100),easeConfidence=clamp((100-effortScore)*0.35+resultScore*0.50+directionalCloseScore*0.15,0,100);
   const eventBiasDir=failedProgress?-attemptDir:lowEffortProgress?progressDir:0,eventConfidence=failedProgress?failedConfidence:lowEffortProgress?easeConfidence:0;
   const liveConfidence=eventConfidence>0?eventConfidence:clamp(Math.abs(resultScore-effortScore)*0.45+Math.abs(efficiencyScore-100)*0.20,0,100),biasScore=eventBiasDir*eventConfidence;
   const eventName=failedProgress?(eventBiasDir>0?'BEAR FAIL':'BULL FAIL'):lowEffortProgress?(eventBiasDir>0?'EASE UP':'EASE DOWN'):'BALANCED';
   const cooldownReady=!lastAccepted||i-lastAccepted.index>=p.cooldownBars,confirmedGate=!p.confirmOnClose||isConfirmed,qualifiedEvent=(failedProgress||lowEffortProgress)&&eventConfidence>=p.minConfidence&&cooldownReady&&confirmedGate;
   const bar={index:i,date,open,close,low,high,atr,trueRange,safeAtr,barRange,safeVolume,avgVolume,relVolume,spreadAtr,effortRaw,effortScore,hasProgressHistory,rawProgress,progressDir,closeLocation,directionalCloseScore,progressScore,resultScore,efficiencyScore,upperWick,lowerWick,wickBalance,candleDir,attemptDir,enoughHistory,highEffort,lowEffort,poorResult,strongResult,failedProgress,lowEffortProgress,failedConfidence,easeConfidence,eventBiasDir,eventConfidence,liveConfidence,biasScore,eventName,cooldownReady,confirmedGate,qualifiedEvent,isConfirmed};
   let event=null;if(qualifiedEvent){event=Object.assign({},bar,{proofTracked:false,color:eventBiasDir>0?COLORS.bull:COLORS.bear,labelY:eventBiasDir>0?low-safeAtr*p.labelOffsetAtr:high+safeAtr*p.labelOffsetAtr});events.push(event);lastAccepted=event;}
   // Pine order is important: resolve old proof BEFORE possibly starting new proof.
   if(isConfirmed){
    if(pending){const fav=pending.dir>0?close>=pending.anchor+pending.margin:close<=pending.anchor-pending.margin,adv=pending.dir>0?close<=pending.anchor-pending.margin:close>=pending.anchor+pending.margin;
     let outcome=null;if(adv)outcome='adverse';else if(fav)outcome='followed';else{pending.left--;if(pending.left<=0)outcome='expired';}
     if(outcome){pending.outcome=outcome;pending.resolvedIndex=i;pending.resolvedOn=date;rrTotal++;if(outcome==='followed')rrWon++;pending=null;}
    }
    if(qualifiedEvent&&eventBiasDir!==0&&!pending){pending={eventIndex:i,eventDate:date,dir:eventBiasDir,anchor:close,margin:safeAtr*p.reactionTargetAtr,eventAtr:safeAtr,left:p.reactionWindow,outcome:'pending'};proofs.push(pending);event.proofTracked=true;}
   }
   const rrRate=rrTotal>0?rrWon/rrTotal*100:NaN;
   // Any newer event replaces/removes prior range, even if below box confidence.
   if(activeBox&&i-activeBox.startIndex>p.boxExtendBars)activeBox=null;
   if(qualifiedEvent)activeBox=null;
   if(qualifiedEvent&&p.showBoxes&&eventConfidence>=p.boxMinConfidence)activeBox={startIndex:i,endIndex:i+p.boxExtendBars,badgeIndex:i+Math.round(p.boxExtendBars*0.68),top:high+safeAtr*p.boxAtrPad,bottom:low-safeAtr*p.boxAtrPad,event};
   if(qualifiedEvent&&p.showLabels){labels.push(event);while(labels.length>p.maxEventLabels)labels.shift();}
   const recentAccepted=!!lastAccepted&&i-lastAccepted.index<=p.boxExtendBars,panelBiasDir=recentAccepted?lastAccepted.eventBiasDir:0,panelConfidence=recentAccepted?lastAccepted.eventConfidence:liveConfidence;
   Object.assign(bar,{rrTotal,rrWon,rrRate,rrPending:pending?Object.assign({},pending):null,recentAccepted,panelBiasDir,panelConfidence,
    biasText:panelBiasDir>0?'Bullish / '+lastAccepted.eventName:panelBiasDir<0?'Bearish / '+lastAccepted.eventName:'Neutral',actionText:recentAccepted?'Review '+lastAccepted.eventName:'Wait for imbalance',
    effortState:highEffort?'High':lowEffort?'Low':'Normal',resultState:poorResult?'Poor':strongResult?'Strong':'Balanced',efficiencyState:efficiencyScore>=125?'Efficient':efficiencyScore<=70?'Inefficient':'Matched'});
   bars.push(bar);
  });
  return {inputs:p,minTick,rows,bars,events,labels,activeBox,proofs,lastAccepted,latest:bars.length?bars[bars.length-1]:null,excludedIncomplete:input.length-rows.length,rrTotal,rrWon,rrRate:rrTotal?rrWon/rrTotal*100:NaN,pending:pending?Object.assign({},pending):null};
 }
 const rgba=(hex,opacity)=>'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+opacity+')';
 const one=v=>finite(v)?v.toFixed(1):'na',whole=v=>finite(v)?String(Math.round(v)):'na';
 function eventExplanation(e,result){const p=result.proofs.find(p=>p.eventIndex===e.index);return '量价顶底 · '+e.eventName+'<br>AGProLabs v1.3 前端移植；已完成K '+e.date+'<br>反应偏向 '+(e.eventBiasDir>0?'向上':'向下')+'；置信 '+one(e.eventConfidence)+'<br>Effort '+one(e.effortScore)+' / Result '+one(e.resultScore)+' / Efficiency '+one(e.efficiencyScore)+'<br>事件锁定ATR '+one(e.safeAtr)+'，收盘验证距离 '+one(e.safeAtr*result.inputs.reactionTargetAtr)+'<br>历史跟随核验：'+(p?p.outcome+(p.resolvedOn?' / '+p.resolvedOn:'（仍待后续完成K）'):'已有待核验事件；按原版不另入统计')+'<br>非确定顶部/底部，不承诺反转；与TradingView历史/行情源可能不同。';}
 function series(result){
  const p=result.inputs,list=[];
  if(p.showLabels)['bull','bear'].forEach(type=>{const bull=type==='bull',color=bull?COLORS.bull:COLORS.bear;
   list.push({name:'量价顶底·'+(bull?'向上':'向下'),type:'scatter',xAxisIndex:0,yAxisIndex:0,z:12,symbol:'circle',symbolSize:2,clip:true,itemStyle:{color},label:{show:true,position:bull?'bottom':'top',fontSize:12,color:'#0f172a',padding:[4,6],borderRadius:3,backgroundColor:rgba(color,1-p.labelBackgroundTransparency/100),formatter:params=>params.data.labelText},tooltip:{trigger:'item',formatter:params=>params.data.explanation},data:result.labels.filter(e=>(e.eventBiasDir>0)===bull).map(e=>({value:[e.date,e.labelY],labelText:e.eventName+(p.showLabelConfidence?' | C'+whole(e.eventConfidence):''),explanation:eventExplanation(e,result)}))});
  });
  if(p.showMarkers)['bull','bear'].forEach(type=>{const bull=type==='bull';list.push({name:'量价顶底·'+type+'标记',type:'scatter',symbol:'triangle',symbolRotate:bull?0:180,symbolSize:7,itemStyle:{color:bull?COLORS.bull:COLORS.bear},data:result.events.filter(e=>(e.eventBiasDir>0)===bull).map(e=>[e.date,bull?e.low:e.high])});});
  const box=result.activeBox;
  if(box){const e=box.event,end=Math.min(box.endIndex,result.rows.length-1),endDate=result.rows[end][0];list.push({name:'量价顶底·当前反应框',type:'line',data:[],silent:true,symbol:'none',markArea:{silent:true,itemStyle:{color:rgba(e.color,1-p.boxTransparency/100),borderColor:rgba(e.color,1-Math.max(p.boxTransparency-18,0)/100),borderWidth:1},label:{show:true,color:'#0f172a',fontSize:11,position:'inside',formatter:e.eventName+' | C'+whole(e.eventConfidence)+' | E'+whole(e.effortScore)+'/R'+whole(e.resultScore)},data:[[{xAxis:e.date,yAxis:box.top},{xAxis:endDate,yAxis:box.bottom}]]}});}
  return list;
 }
 function panelText(result){const b=result.latest;if(!b)return '量价顶底 · AGProLabs v1.3\n暂无已完成日K；不生成信号。';return '量价顶底 · AGPro Effort vs Result Reaction Map v1.3\n'+b.date+' 已完成日K（排除当天 '+result.excludedIncomplete+' 根）\nEffort '+one(b.effortScore)+' / '+b.effortState+'　Result '+one(b.resultScore)+' / '+b.resultState+'\nEfficiency '+one(b.efficiencyScore)+' / '+b.efficiencyState+'　Reaction Bias '+b.biasText+'\nAction '+b.actionText+'　Confidence '+one(b.panelConfidence)+'\nReaction Rate '+(finite(b.rrRate)?whole(b.rrRate)+'% ('+b.rrTotal+')':'Building')+'；待核验 '+(b.rrPending?'1':'0')+'；样本事件 '+result.events.length+'\n历史收盘跟随统计，非预测胜率；250根新浪连续日K，不承诺原版软件逐点一致。';}
 function axisTooltip(params,result,allRows){
  params=Array.isArray(params)?params:[params];if(!params.length)return '';
  const escape=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=params[0].axisValue||params[0].name,lines=[escape(date)];
  params.forEach(p=>{const row=allRows[p.dataIndex];let value=p.value;
   if(p.seriesType==='candlestick'&&row)value='开 '+row[1]+' / 收 '+row[2]+' / 低 '+row[3]+' / 高 '+row[4];
   else if(Array.isArray(value))value=value.join(' / ');
   if(value!=null)lines.push(escape(p.seriesName)+'：'+escape(value));
  });
  const b=result.bars.find(b=>b.date===date);
  if(b)lines.push('量价顶底 · AGProLabs v1.3（已完成K）','Effort '+one(b.effortScore)+' / Result '+one(b.resultScore),'Efficiency '+one(b.efficiencyScore)+' / Bias '+one(b.biasScore),'Confidence '+one(b.liveConfidence)+' / Follow Rate '+(finite(b.rrRate)?one(b.rrRate)+'% ('+b.rrTotal+')':'Building'));
  else lines.push('量价顶底：该日K未完成或不在有效样本，不确认事件/反应结果。');
  return lines.join('<br>');
 }
 return {DEFAULTS,COLORS,sma,rma,calculate,series,panelText,eventExplanation,axisTooltip};
});
