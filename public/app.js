(function () {
  'use strict';
  var KEY = 'classroom-helper-student-numbers-v2';
  var FIELDS = ['homework', 'scarf', 'duty', 'assigned', 'drawn'];
  var MODES = {
    homework: {label:'作业',title:'作业登记',hint:'点学号标记已交，再点一次撤回。',done:'已交',pending:'待交',desc:'已交作业',pendingTitle:'还没交作业'},
    scarf: {label:'红领巾',title:'红领巾登记',hint:'点学号标记已带，再点一次撤回。',done:'已带',pending:'未带',desc:'已带红领巾',pendingTitle:'还没带红领巾'},
    duty: {label:'值日',title:'值日登记',hint:'先安排当天值日生，完成后点学号打勾。',done:'已完成',pending:'待完成',desc:'已完成值日',pendingTitle:'还没完成值日'}
  };
  function $(id) { return document.getElementById(id); }
  function all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function has(list, item) { return list.indexOf(item) !== -1; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function copyRoster(roster) { return roster.map(function(s) { return {id:s.id,number:s.number}; }); }
  function el(tag, className, text) { var e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
  function append(parent, nodes) { nodes.forEach(function(n) { parent.appendChild(n); }); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function focus(e) { if (e) e.focus(); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; var a=value.split('-'), d=new Date(Number(a[0]),Number(a[1])-1,Number(a[2])); return d.getFullYear()===Number(a[0]) && d.getMonth()+1===Number(a[1]) && d.getDate()===Number(a[2]); }
  function validRoster(roster) {
    if (!Array.isArray(roster) || !roster.length || roster.length>100) return false;
    var ids=[], numbers=[];
    return roster.every(function(s) { if (!s || typeof s.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(s.id) || typeof s.number!=='string' || !/^\d{2,4}$/.test(s.number) || Number(s.number)<1 || has(ids,s.id) || has(numbers,s.number)) return false; ids.push(s.id);numbers.push(s.number);return true; });
  }
  function validState(s) {
    if (!s || !validRoster(s.roster) || !s.days || typeof s.days!=='object' || Array.isArray(s.days) || Object.keys(s.days).length>5000) return false;
    return Object.keys(s.days).every(function(date) { var d=s.days[date];return validDate(date) && d && (!d.roster || validRoster(d.roster)) && FIELDS.every(function(k) { return Array.isArray(d[k]) && d[k].length<=100 && d[k].every(function(x) {return typeof x==='string';}); }); });
  }
  function normalize(s) {
    var clean={roster:copyRoster(s.roster),days:{}};
    Object.keys(s.days).forEach(function(date) { var old=s.days[date], roster=copyRoster(old.roster || s.roster), ids=roster.map(function(x){return x.id;}), d={roster:roster};FIELDS.forEach(function(k){d[k]=old[k].filter(function(id,i,list){return has(ids,id)&&list.indexOf(id)===i;});});d.duty=d.duty.filter(function(id){return has(d.assigned,id);});if(typeof old.updatedAt==='string') d.updatedAt=old.updatedAt;clean.days[date]=d; });
    return clean;
  }
  var sample=[];for(var i=1;i<=42;i++) sample.push({id:'student-'+pad(i),number:pad(i)});
  var state={roster:sample,days:{}}, mode='homework', selectedDate=today(), undoState=null, storageOkay=true, toastTimer, activeModal=null, returnFocus=null;
  try { var saved=localStorage.getItem(KEY);if(saved){var parsed=JSON.parse(saved);if(validState(parsed))state=normalize(parsed);else storageOkay=false;} } catch(error) {storageOkay=false;}
  function day() { if(!state.days[selectedDate]) state.days[selectedDate]={homework:[],scarf:[],duty:[],assigned:[],drawn:[],roster:copyRoster(state.roster)};return state.days[selectedDate]; }
  function recorded(d) {return !!d.updatedAt || FIELDS.some(function(k){return d[k].length>0;});}
  function rosterForMode() {return mode==='duty'?day().roster.filter(function(s){return has(day().assigned,s.id);}):day().roster;}
  function notify(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(function(){$('toast').hidden=true;},3200);}
  function updateSaveStatus() {$('save-status').textContent=storageOkay?'记录保存在当前浏览器':'浏览器未能保存，请下载本机备份';$('save-status').style.color=storageOkay?'':'#a34635';}
  function persist() {try{localStorage.setItem(KEY,JSON.stringify(state));storageOkay=true;}catch(error){storageOkay=false;}updateSaveStatus();return storageOkay;}
  function save() {day().updatedAt=new Date().toISOString();return persist();}
  function remember() {undoState=JSON.stringify({state:state,selectedDate:selectedDate,mode:mode});}
  function selectDate(date) {selectedDate=date;$('date').value=date;undoState=null;render();}
  function showModal(id) {returnFocus=document.activeElement;activeModal=$(id);activeModal.hidden=false;$('modal-backdrop').hidden=false;document.body.style.overflow='hidden';focus(activeModal);}
  function closeModal() {if(!activeModal)return;activeModal.hidden=true;activeModal=null;$('modal-backdrop').hidden=true;document.body.style.overflow='';focus(returnFocus);}
  function renderHistory() {
    var dates=Object.keys(state.days).filter(function(date){return recorded(state.days[date]);}).sort().reverse();
    $('history-count').textContent=dates.length+' 天';clear($('history-list'));
    if(!dates.length){$('history-list').appendChild(el('p','history-empty','尚无历史记录。登记后会自动保存，也可以保存当天全部待完成的状态。'));return;}
    dates.forEach(function(date){
      var d=state.days[date], row=el('article','history-row'+(date===selectedDate?' selected':'')), heading=el('div','history-date'), metrics=el('div','history-metrics');
      append(heading,[el('strong','',date),el('span','',date===selectedDate?'正在查看':d.roster.length+' 位同学')]);
      ['homework','scarf','duty'].forEach(function(k){var roster=k==='duty'?d.roster.filter(function(s){return has(d.assigned,s.id);}):d.roster;var done=roster.filter(function(s){return has(d[k],s.id);}).length,item=el('div');append(item,[el('span','',MODES[k].label),el('strong','',roster.length?done+' / '+roster.length:'未安排')]);metrics.appendChild(item);});
      var helper=d.roster.filter(function(s){return s.id===d.drawn[d.drawn.length-1];})[0];
      var extra=el('p','history-helper','小助手：'+(helper?helper.number+'号':'未抽取')),view=el('button','quiet-button','查看当天');view.type='button';view.setAttribute('aria-label','查看'+date+'的登记状态');view.addEventListener('click',function(){selectDate(date);$('task-panel').scrollIntoView(true);focus($('date'));});
      append(row,[heading,metrics,extra,view]);$('history-list').appendChild(row);
    });
  }
  function render() {
    var d=day(),cfg=MODES[mode],students=rosterForMode(),done=students.filter(function(s){return has(d[mode],s.id);}),pending=students.filter(function(s){return !has(d[mode],s.id);});
    $('viewing-date').textContent=selectedDate===today()?'正在登记今天 · '+selectedDate:'正在查看 '+selectedDate+' · 修改会更新该日记录';$('back-today').hidden=selectedDate===today();
    all('[data-mode]').forEach(function(b){var selected=b.getAttribute('data-mode')===mode;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    $('task-panel').setAttribute('aria-labelledby','tab-'+mode);$('task-title').textContent=cfg.title;$('task-hint').textContent=cfg.hint;
    $('class-count').textContent=(mode==='duty'?'当天值日 ':'全班 ')+students.length+' 人';$('duty-open').hidden=mode!=='duty';$('all-done').textContent='全部标记'+cfg.done;$('all-done').disabled=!pending.length;$('undo').disabled=!undoState;
    clear($('students'));
    students.forEach(function(s){
      var checked=has(d[mode],s.id), b=el('button','student'+(checked?' done':''));b.type='button';b.id='card-'+s.id;b.setAttribute('aria-pressed',String(checked));b.setAttribute('aria-label',s.number+'号，'+(checked?cfg.done:cfg.pending)+'，点击'+(checked?'撤回':'标记'+cfg.done));
      append(b,[el('span','number','学号'),el('span','student-number',s.number+'号'),el('span','state',checked?cfg.done:cfg.pending),el('span','tick','✓')]);
      b.addEventListener('click',function(){remember();var list=day()[mode];day()[mode]=has(list,s.id)?list.filter(function(id){return id!==s.id;}):list.concat([s.id]);save();render();focus($('card-'+s.id));});$('students').appendChild(b);
    });
    if(!students.length){var empty=el('div','empty'),arrange=el('button','primary-button','安排当天的值日生');empty.appendChild(el('div','','当天还没有安排值日生'));arrange.onclick=openDuty;empty.appendChild(arrange);$('students').appendChild(empty);}
    $('legend-text').textContent='打勾表示'+cfg.done;$('summary-tag').textContent=cfg.label;$('done-count').textContent=done.length;$('total-count').textContent=students.length;$('count-description').textContent=cfg.desc;
    var percent=students.length?Math.round(done.length/students.length*100):0;$('progress-fill').style.width=percent+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(percent));
    $('pending-description').textContent=cfg.pending;$('pending-count').textContent=pending.length+' 人';$('pending-title').textContent=cfg.pendingTitle;$('pending-badge').textContent=pending.length+' 人';clear($('pending-names'));
    if(pending.length)pending.forEach(function(s){$('pending-names').appendChild(el('span','',s.number+'号'));});else $('pending-names').appendChild(el('p','',students.length?'全部完成，真棒！ ✓':'安排值日生后，这里会显示待完成学号。'));
    var helper=d.roster.filter(function(s){return s.id===d.drawn[d.drawn.length-1];})[0];$('helper-name').textContent=helper?helper.number+'号':'会是谁呢？';$('helper-note').textContent=helper?'已当选 · 再抽一位也可以':'从当日全班同学中随机抽取';$('draw').firstChild.nodeValue=helper?'再抽一位小助手 ':'抽一位小助手 ';
    updateSaveStatus();renderHistory();
  }
  $('date').value=selectedDate;$('date').setAttribute('placeholder','YYYY-MM-DD');
  if($('date').type==='text')$('date').setAttribute('title','请输入日期，例如 2026-09-13');
  $('date').addEventListener('change',function(){var value=$('date').value;if(!validDate(value)){notify('请输入有效日期，格式为 YYYY-MM-DD');$('date').value=selectedDate;return;}selectDate(value);});
  $('back-today').addEventListener('click',function(){selectDate(today());});
  all('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.getAttribute('data-mode');render();});b.addEventListener('keydown',function(e){var keys=['homework','scarf','duty'],i=keys.indexOf(mode),k=e.keyCode;if(k===39)i=(i+1)%3;else if(k===37)i=(i+2)%3;else if(k===36)i=0;else if(k===35)i=2;else return;e.preventDefault();mode=keys[i];render();focus($('tab-'+mode));});});
  $('all-done').addEventListener('click',function(){remember();day()[mode]=rosterForMode().map(function(s){return s.id;});save();render();notify('已全部标记'+MODES[mode].done+'，可以撤销');});
  $('undo').addEventListener('click',function(){if(!undoState)return;var prior=JSON.parse(undoState);state=prior.state;selectedDate=prior.selectedDate;mode=prior.mode;undoState=null;$('date').value=selectedDate;persist();render();notify('已撤销上一步');});
  $('save-day').addEventListener('click',function(){remember();var ok=save();render();notify(ok?'已保存 '+selectedDate+' 的完整状态':'请使用“保存备份到本机”保存记录');});
  $('password-open').addEventListener('click',function(){['old-password','new-password','confirm-password'].forEach(function(id){$(id).value='';});$('password-error').textContent='';showModal('password-dialog');});
  all('[data-close]').forEach(function(b){b.addEventListener('click',closeModal);});
  document.addEventListener('keydown',function(e){if(!activeModal)return;if(e.keyCode===27){e.preventDefault();closeModal();return;}if(e.keyCode!==9)return;var items=all('button,input,textarea,[tabindex]',activeModal).filter(function(x){return !x.disabled&&!x.hidden&&x.tabIndex>=0;});if(!items.length){e.preventDefault();return;}var first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===activeModal)){e.preventDefault();focus(last);}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===activeModal)){e.preventDefault();focus(first);}});
  $('roster-open').addEventListener('click',function(){$('roster-input').value=day().roster.map(function(s){return s.number;}).join('\n');$('student-count').value=day().roster.length;$('roster-error').textContent='';showModal('roster-dialog');});
  $('generate-numbers').addEventListener('click',function(){var count=Number($('student-count').value);if(!isFinite(count)||Math.floor(count)!==count||count<1||count>100){$('roster-error').textContent='全班人数请填写 1—100 的整数。';return;}var numbers=[];for(var i=1;i<=count;i++)numbers.push(pad(i));$('roster-input').value=numbers.join('\n');$('roster-error').textContent='';});
  $('roster-form').addEventListener('submit',function(e){
    e.preventDefault();var values=$('roster-input').value.split(/[\s,，、;；]+/).filter(function(v){return !!v;});
    if(values.some(function(v){return !/^\d{1,4}$/.test(v)||Number(v)<1;})){$('roster-error').textContent='学号只能填写 1—9999 的数字，例如 01、02、03。';return;}
    var numbers=values.map(function(v){return pad(Number(v));});if(!numbers.length||numbers.length>100){$('roster-error').textContent='请填写 1—100 个学号。';return;}
    if(numbers.some(function(v,i){return numbers.indexOf(v)!==i;})){$('roster-error').textContent='有重复学号；1 和 01 视为同一学号。';return;}
    remember();var existing=day().roster;state.roster=numbers.map(function(number){return existing.filter(function(s){return s.number===number;})[0]||{number:number,id:'student-'+number};});
    var ids=state.roster.map(function(s){return s.id;});day().roster=copyRoster(state.roster);FIELDS.forEach(function(k){day()[k]=day()[k].filter(function(id){return has(ids,id);});});Object.keys(state.days).forEach(function(date){if(!recorded(state.days[date]))state.days[date].roster=copyRoster(state.roster);});
    save();closeModal();render();notify('学号已更新，其他已保存日期保持不变');
  });
  function openDuty(){clear($('duty-options'));day().roster.forEach(function(s){var label=el('label'),input=el('input');input.type='checkbox';input.value=s.id;input.checked=has(day().assigned,s.id);append(label,[input,document.createTextNode(s.number+'号')]);$('duty-options').appendChild(label);});showModal('duty-dialog');}
  $('duty-open').addEventListener('click',openDuty);
  $('duty-form').addEventListener('submit',function(e){e.preventDefault();remember();day().assigned=all('input:checked',$('duty-options')).map(function(x){return x.value;});day().duty=day().duty.filter(function(id){return has(day().assigned,id);});save();closeModal();render();notify('当天值日已安排');});
  function randomIndex(length){var rng=window.crypto||window.msCrypto;if(rng&&rng.getRandomValues){var range=4294967296,limit=Math.floor(range/length)*length,a=new Uint32Array(1);do{rng.getRandomValues(a);}while(a[0]>=limit);return a[0]%length;}return Math.floor(Math.random()*length);}
  $('draw').addEventListener('click',function(){remember();var d=day(),pool=d.roster.filter(function(s){return !has(d.drawn,s.id);}),newRound=!pool.length;if(newRound){d.drawn=[];pool=d.roster;}var winner=pool[randomIndex(pool.length)];d.drawn.push(winner.id);save();render();$('winner').textContent=winner.number+'号';showModal('helper-dialog');if(newRound)notify('全班都当选过啦，开始新一轮');});
  function backupPayload(){var data=copy(state);Object.keys(data.days).forEach(function(date){if(!recorded(data.days[date]))delete data.days[date];});return {app:'tianyi-class-helper',schemaVersion:1,className:'天翊班',exportedAt:new Date().toISOString(),data:data};}
  $('export-backup').addEventListener('click',function(){
    save();render();var payload=backupPayload(),filename='tianyi-class-records-'+today()+'.json';
    try{var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});if(navigator.msSaveOrOpenBlob){if(navigator.msSaveOrOpenBlob(blob,filename)===false)throw new Error('download');}else{var url=(window.URL||window.webkitURL).createObjectURL(blob),a=el('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){(window.URL||window.webkitURL).revokeObjectURL(url);},60000);}$('backup-status').textContent='已发起下载，包含 '+Object.keys(payload.data.days).length+' 天记录。请在浏览器中完成保存。';}catch(error){$('backup-status').textContent='当前浏览器未能下载。请用手机系统浏览器或电脑浏览器打开此网址后重试。';}
  });
  $('import-backup').addEventListener('click',function(){$('backup-file').value='';$('backup-file').click();});
  $('backup-file').addEventListener('change',function(){
    var file=this.files&&this.files[0];if(!file)return;if(file.size>10*1024*1024){$('backup-status').textContent='备份文件过大，请选择本工具导出的 JSON 文件（10 MB 以内）。';return;}
    var reader=new FileReader();reader.onerror=function(){$('backup-status').textContent='文件读取失败，请重新选择。';};reader.onload=function(){
      var incoming;
      try{var payload=JSON.parse(String(reader.result).replace(/^\uFEFF/,''));if(!payload||payload.app!=='tianyi-class-helper'||payload.schemaVersion!==1||!validState(payload.data))throw new Error('invalid');incoming=normalize(payload.data);}catch(error){$('backup-status').textContent='文件不是有效的天翊班备份，现有记录未修改。';return;}
      var dates=Object.keys(incoming.days),conflicts=dates.filter(function(date){return state.days[date]&&recorded(state.days[date]);});
      if(!window.confirm('备份含 '+dates.length+' 天记录，将合并到当前浏览器。'+(conflicts.length?'其中 '+conflicts.length+' 个同日期的记录将以备份为准。':'')+'默认学号也会恢复为备份中的设置。是否继续？'))return;
      var merged=copy(state);merged.roster=copyRoster(incoming.roster);dates.forEach(function(date){merged.days[date]=incoming.days[date];});if(Object.keys(merged.days).length>5000){$('backup-status').textContent='合并后超过 5000 天记录，现有记录未修改。';return;}
      remember();state=merged;Object.keys(state.days).forEach(function(date){if(!recorded(state.days[date]))state.days[date].roster=copyRoster(state.roster);});var ok=persist();render();$('backup-status').textContent=ok?'已恢复 '+dates.length+' 天记录，可在历史记录中查看。误操作可点“撤销”。':'已读取备份，但浏览器无法保存。请保留原备份文件，勿清理或关闭当前页面。';
    };reader.readAsText(file,'UTF-8');
  });
  render();if(!storageOkay)notify('浏览器记录未能读取；可使用本机备份恢复');
}());
