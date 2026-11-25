/* 量价顶底 · 用户自定三规则 t73 (2026-11-25).
 * This is a new implementation of the user's rules, NOT the AGPro algorithm.
 * Input rows: [YYYY-MM-DD, open, close, low, high, volume]. No data fetching.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UserPriceVolume=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TYPES=Object.freeze({top:'顶部',bottom1:'底一·放量长下影',bottom2:'底二·缩量不创新低'});
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const average=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const display=v=>finite(v)?String(Number(v.toFixed(8))):'不足周期';
 const escape=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function shanghaiDate(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day;}
 function validDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
 function validate(rows){if(!Array.isArray(rows))throw Error('量价顶底：输入须为数组');let previous='';for(const r of rows){
  if(!Array.isArray(r)||!validDate(r[0])||r[0]<=previous)throw Error('量价顶底：日期无效/重复/乱序');previous=r[0];
  if(![r[1],r[2],r[3],r[4],r[5]].every(finite)||r[3]<0||r[5]<0||r[3]>Math.min(r[1],r[2])||r[4]<Math.max(r[1],r[2]))throw Error('量价顶底：OHLCV无效');
 }}
 function calculate(input,options){
  options=options||{};validate(input);const asOfDate=options.asOfDate===undefined?shanghaiDate():options.asOfDate;if(!validDate(asOfDate))throw Error('量价顶底：完成日截止日期无效');
  const rows=input.filter(r=>r[0]<asOfDate),events=[],candidates=[],bars=[];
  const closes=rows.map(r=>r[2]),volumes=rows.map(r=>r[5]);
  for(let t=0;t<rows.length;t++){
   const [date,open,close,low,high,volume]=rows[t],range=high-low,upper=high-Math.max(open,close),lower=Math.min(open,close)-low;
   const ma5=t>=4?average(closes.slice(t-4,t+1)):null,ma30=t>=29?average(closes.slice(t-29,t+1)):null;
   const prev5Volume=t>=5?average(volumes.slice(t-5,t)):null,volumeThreshold=prev5Volume===null?null:prev5Volume*1.3;
   const expanded=prev5Volume!==null&&volume>=volumeThreshold;
   const topSetup=ma5!==null&&close>ma5&&expanded&&range>0&&upper>range*0.3;
   const bottom1Setup=ma30!==null&&close<ma30&&expanded&&range>0&&lower>range*0.3;
   let near5Low=null,prior20Low=null,near5Volume=null,prior5Volume=null,bottom2Setup=false;
   if(t>=24){near5Low=Math.min(...rows.slice(t-4,t+1).map(r=>r[3]));prior20Low=Math.min(...rows.slice(t-24,t-4).map(r=>r[3]));near5Volume=average(volumes.slice(t-4,t+1));prior5Volume=average(volumes.slice(t-9,t-4));bottom2Setup=near5Low>=prior20Low&&near5Volume<prior5Volume*0.85;}
   const bar={index:t,date,open,close,low,high,volume,range,upper,lower,ma5,ma30,prev5Volume,volumeThreshold,expanded,topSetup,bottom1Setup,bottom2Setup,near5Low,prior20Low,near5Volume,prior5Volume};bars.push(bar);
   for(const kind of ['top','bottom1'])if(kind==='top'?topSetup:bottom1Setup){
    const next=rows[t+1],accepted=next?(kind==='top'?next[4]<=high:next[3]>=low):false;
    const candidate={kind,markDate:date,markIndex:t,price:kind==='top'?high:low,status:next?(accepted?'confirmed':'rejected'):'pending',knownOn:next?next[0]:null,knownIndex:next?t+1:null,confirmValue:next?(kind==='top'?next[4]:next[3]):null,bar};
    candidates.push(candidate);if(accepted)events.push(Object.assign({},candidate,{confirmedOn:next[0],confirmedIndex:t+1}));
   }
   if(bottom2Setup)events.push({kind:'bottom2',markDate:date,markIndex:t,price:low,status:'confirmed',knownOn:date,knownIndex:t,confirmedOn:date,confirmedIndex:t,bar,
    windows:{near5:{from:rows[t-4][0],to:date,count:5},prior20:{from:rows[t-24][0],to:rows[t-5][0],count:20},prior5:{from:rows[t-9][0],to:rows[t-5][0],count:5}}});
  }
  events.sort((a,b)=>a.markIndex-b.markIndex||['top','bottom1','bottom2'].indexOf(a.kind)-['top','bottom1','bottom2'].indexOf(b.kind));
  // Merge ONLY coincident bottom marker locations, not signals or consecutive days.
  const bottomPoints=[];for(const e of events.filter(e=>e.kind!=='top')){let point=bottomPoints[bottomPoints.length-1];if(!point||point.markIndex!==e.markIndex){point={markDate:e.markDate,markIndex:e.markIndex,price:e.price,events:[]};bottomPoints.push(point);}point.events.push(e);}
  return {ruleVersion:'user-t73-v1',asOfDate,rows,bars,events,candidates,pending:candidates.filter(c=>c.status==='pending'),topPoints:events.filter(e=>e.kind==='top'),bottomPoints,excludedIncomplete:input.length-rows.length,latest:bars.length?bars[bars.length-1]:null};
 }
 function explanation(e){
  const b=e.bar,head=TYPES[e.kind]+' · 用户自定规则<br>标注/候选日：'+e.markDate+'；标注价：'+display(e.price)+'<br>实际确认日：'+e.confirmedOn;
  if(e.kind==='bottom2'){const w=e.windows;return head+'（本窗口末日，不等次日）<br>近5日 '+w.near5.from+'～'+w.near5.to+'，最低 '+display(b.near5Low)+'<br>此前不重叠20日 '+w.prior20.from+'～'+w.prior20.to+'，最低 '+display(b.prior20Low)+'；近5最低 ≥ 此前20最低<br>近5均量 '+display(b.near5Volume)+' &lt; 此前5均量 '+display(b.prior5Volume)+' ×0.85 = '+display(b.prior5Volume*0.85)+'<br>此前5日 '+w.prior5.from+'～'+w.prior5.to+'；每个满足窗口末日均标记，不去重、不要求MA30。';}
  const top=e.kind==='top';return head+'（下一个已完成交易日）<br>这是次日确认后回标，不是放量日当时已知。<br>收盘 '+display(b.close)+(top?' &gt; MA5 ':' &lt; MA30 ')+display(top?b.ma5:b.ma30)+'（MA含候选日）<br>成交量 '+display(b.volume)+' ≥ 前5日均量 '+display(b.prev5Volume)+' ×1.3 = '+display(b.volumeThreshold)+'（前5不含候选日）<br>'+(top?'上':'下')+'影 '+display(top?b.upper:b.lower)+' &gt; 全振幅 '+display(b.range)+' ×0.30 = '+display(b.range*.3)+'<br>次日'+(top?'最高 ':'最低 ')+display(e.confirmValue)+(top?' ≤ 候选日最高 ':' ≥ 候选日最低 ')+display(e.price)+'<br>规则标记不保证真实顶部/底部或后续反转。';
 }
 function series(result){
  return [{name:'量价顶底·顶部',type:'scatter',symbol:'triangle',symbolRotate:180,symbolSize:10,z:13,clip:true,xAxisIndex:0,yAxisIndex:0,itemStyle:{color:'#bd3434',borderColor:'#fff',borderWidth:1},label:{show:true,position:'top',color:'#bd3434',fontSize:10,backgroundColor:'rgba(255,255,255,.85)',padding:2,formatter:()=> '顶'},labelLayout:{hideOverlap:true},tooltip:{trigger:'item',formatter:p=>p.data.explanation},data:result.topPoints.map(e=>({value:[e.markDate,e.price],knownOn:e.knownOn,explanation:explanation(e)}))},
   {name:'量价顶底·底部',type:'scatter',symbol:'triangle',symbolSize:10,z:13,clip:true,xAxisIndex:0,yAxisIndex:0,itemStyle:{color:'#087e62',borderColor:'#fff',borderWidth:1},label:{show:true,position:'bottom',color:'#087e62',fontSize:10,backgroundColor:'rgba(255,255,255,.85)',padding:2,formatter:p=>p.data.labelText},labelLayout:{hideOverlap:true},tooltip:{trigger:'item',formatter:p=>p.data.explanation},data:result.bottomPoints.map(p=>({value:[p.markDate,p.price],labelText:p.events.map(e=>e.kind==='bottom1'?'底一':'底二').join('+'),knownOn:p.events.map(e=>e.knownOn),explanation:p.events.map(explanation).join('<br>────────<br>')}))}];
 }
 function panelText(result){if(!result.latest)return '量价顶底 · 用户自定三规则\n暂无已完成日K，不生成标记。';const count=kind=>result.events.filter(e=>e.kind===kind).length;return '量价顶底 · 用户自定三规则\n完成日线截至 '+result.latest.date+'；排除当天/未来 '+result.excludedIncomplete+' 根\n顶部 '+count('top')+' / 底一·放量长下影 '+count('bottom1')+' / 底二·缩量不创新低 '+count('bottom2')+'；待次日确认 '+result.pending.length+'\n顶/底一仅在次日完成且未破高/低后回标放量日，悬停可查实际确认日；并非当日预知。\n底二：近5日含末日，对比之前不重叠20日最低价、之前5日均量；每个满足末日均标。规则不保证反转。';}
 function axisTooltip(params,result,allRows){params=Array.isArray(params)?params:[params];if(!params.length)return '';const day=params[0].axisValue||params[0].name,lines=[escape(day)];
  for(const p of params){let value=p.value;const r=allRows[p.dataIndex];if(p.seriesType==='candlestick'&&r)value='开 '+r[1]+' / 收 '+r[2]+' / 低 '+r[3]+' / 高 '+r[4];else if(Array.isArray(value))value=value.join(' / ');if(value!=null)lines.push(escape(p.seriesName)+'：'+escape(value));}
  const b=result.bars.find(b=>b.date===day);if(!b)lines.push('量价顶底：未完成日K不确认任何信号。');else{lines.push('量价顶底 · 用户规则；MA5 '+display(b.ma5)+' / MA30 '+display(b.ma30),'前5日均量（不含当日） '+display(b.prev5Volume)+'；1.3倍 '+display(b.volumeThreshold));for(const e of result.events.filter(e=>e.markDate===day))lines.push(TYPES[e.kind]+'：'+e.markDate+' 标注，'+e.knownOn+' 确认');if(result.pending.some(e=>e.markDate===day))lines.push('存在候选，尚无下一根已完成日K，未确认为顶/底一。');}return lines.join('<br>');
 }
 return {TYPES,calculate,series,panelText,axisTooltip,explanation,shanghaiDate};
});
