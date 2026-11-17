let manifest,tab='供需季节性',sequence=0;
const tags={Div:'div',H1:'h1',H2:'h2',H3:'h3',P:'p',Small:'small',Strong:'strong',Span:'span',Button:'button'};
function render(n){
 if(n==null)return document.createTextNode('');
 if(Array.isArray(n)){const f=document.createDocumentFragment();n.forEach(x=>f.append(render(x)));return f;}
 if(typeof n!=='object')return document.createTextNode(String(n));
 const p=n.props||{};
 if(n.type==='Graph'){const e=document.createElement('div');e.className='dash-graph';setTimeout(()=>Plotly.newPlot(e,p.figure.data,p.figure.layout,{responsive:true,displaylogo:false}),0);return e;}
 if(n.type==='DataTable'){const box=document.createElement('div');box.className='data-table';const t=document.createElement('table');const h=t.insertRow();p.columns.forEach(c=>{const e=document.createElement('th');e.textContent=c.name;h.append(e)});p.data.forEach(r=>{const row=t.insertRow();p.columns.forEach(c=>row.insertCell().textContent=r[c.id]??'')});box.append(t);return box;}
 const e=document.createElement(tags[n.type]||'div');if(p.className)e.className=p.className;if(p.title)e.title=p.title;e.append(render(p.children));return e;
}
async function show(){
 const token=++sequence;
 const q=['供需季节性','期货行情','基差与价差'].includes(tab)?Number(document.querySelector('#quarter').value):0;
 const spread=tab==='基差与价差'?document.querySelector('#spread').value:manifest.spreads[0];
 const region=tab==='产区天气'?document.querySelector('#region').value:manifest.regions[0];
 document.querySelector('#spread').hidden=tab!=='基差与价差';document.querySelector('#region').hidden=tab!=='产区天气';
 const r=await fetch(manifest.views[JSON.stringify([tab,q,spread,region])]);const v=await r.json();if(token!==sequence)return;
 for(const id of ['content','kpis'])document.getElementById(id).replaceChildren(render(v[id].children));
 document.querySelector('#status').textContent=v.status.children.split(' · 自动同步')[0]+' · GitHub 已发布数据';
}
fetch('manifest.json').then(r=>r.json()).then(m=>{manifest=m;for(const id of ['spread','region']){const values=id==='spread'?m.spreads:m.regions;values.forEach(x=>document.getElementById(id).add(new Option(x,x)));}['供需季节性','期货行情','基差与价差','产区天气'].forEach(x=>{const b=document.createElement('button');b.textContent=x;b.onclick=()=>{tab=x;show()};document.querySelector('#tabs').append(b)});document.querySelectorAll('select').forEach(e=>e.onchange=show);show()});
