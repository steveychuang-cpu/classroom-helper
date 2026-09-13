(function () {
  'use strict';
  var KEY = 'classroom-helper-student-numbers-v2';
  var INITIAL_POINTS = 50;
  var FIELDS = ['homework', 'scarf', 'duty', 'assigned', 'drawn'];
  var MODES = {
    homework: {label:'作业',title:'作业登记',hint:'点学号登记。确认未交扣2分；当天补交返1分，隔日补交不返分。未登记不扣分。',done:'已交',pending:'待交',desc:'已交作业',pendingTitle:'还没交作业'},
    scarf: {label:'红领巾',title:'红领巾登记',hint:'点学号选择状态。确认未戴扣1分；未登记不扣分。',done:'已戴',pending:'未登记',desc:'已戴红领巾',pendingTitle:'未戴或未登记'},
    duty: {label:'值日',title:'值日登记',hint:'先安排当天值日生，完成后点学号打勾，当天加1分。',done:'已完成',pending:'待完成',desc:'已完成值日',pendingTitle:'还没完成值日'},
    points: {label:'积分',title:'天翊成长学堂',hint:'每人初始50分，最低0分。每回答2题加1分，小组长和值日各加1分。点学号登记，下方查看积分榜。'}
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
    return Object.keys(s.days).every(function(date) { var d=s.days[date];return validDate(date) && d && (!d.roster || validRoster(d.roster)) && FIELDS.every(function(k) { return Array.isArray(d[k]) && d[k].length<=100 && d[k].every(function(x) {return typeof x==='string';}); }) && validPoints(d); });
  }
  function validPoints(d){
    var arrays=['scarfMissing','homeworkMissing'];
    if(!arrays.every(function(k){return d[k]===undefined||(Array.isArray(d[k])&&d[k].length<=100&&d[k].every(function(id){return typeof id==='string';}));}))return false;
    if(!['scarfMissingAt','homeworkMissingAt','dutyRewardAt'].every(function(k){return d[k]===undefined||(d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])&&Object.keys(d[k]).length<=100&&Object.keys(d[k]).every(function(id){return typeof d[k][id]==='string';}));}))return false;
    if(d.homeworkMakeup!==undefined&&(!d.homeworkMakeup||typeof d.homeworkMakeup!=='object'||Array.isArray(d.homeworkMakeup)||Object.keys(d.homeworkMakeup).length>100||!Object.keys(d.homeworkMakeup).every(function(id){var m=d.homeworkMakeup[id];return m&&validDate(m.submittedOn)&&typeof m.createdAt==='string';})))return false;
    return ['leaderEvents','answerEvents'].every(function(k){if(d[k]===undefined)return true;if(!Array.isArray(d[k])||d[k].length>2000)return false;var ids=[];return d[k].every(function(e){if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(e.id)||has(ids,e.id)||typeof e.studentId!=='string'||typeof e.createdAt!=='string')return false;ids.push(e.id);return true;});});
  }
  function normalizeNewFields(d,old,date,ids){
    d.answerEvents=(old.answerEvents||[]).filter(function(e){return has(ids,e.studentId);}).map(function(e){return {id:e.id,studentId:e.studentId,createdAt:e.createdAt};});
    d.homeworkMissing=(old.homeworkMissing||[]).filter(function(id,i,list){return has(ids,id)&&list.indexOf(id)===i;});d.homeworkMissingAt={};d.homeworkMakeup={};d.dutyRewardAt={};
    d.homeworkMissing.forEach(function(id){d.homeworkMissingAt[id]=(old.homeworkMissingAt||{})[id]||date+'T00:00:00.000Z';var m=(old.homeworkMakeup||{})[id];if(m&&m.submittedOn>=date){d.homeworkMakeup[id]={submittedOn:m.submittedOn,createdAt:m.createdAt};if(!has(d.homework,id))d.homework.push(id);}else d.homework=d.homework.filter(function(x){return x!==id;});});
    d.duty.forEach(function(id){if((old.dutyRewardAt||{})[id])d.dutyRewardAt[id]=old.dutyRewardAt[id];});
  }
  function normalize(s) {
    var clean={roster:copyRoster(s.roster),days:{}};
    Object.keys(s.days).forEach(function(date) { var old=s.days[date], roster=copyRoster(old.roster || s.roster), ids=roster.map(function(x){return x.id;}), d={roster:roster};FIELDS.forEach(function(k){d[k]=old[k].filter(function(id,i,list){return has(ids,id)&&list.indexOf(id)===i;});});d.duty=d.duty.filter(function(id){return has(d.assigned,id);});d.scarfMissing=(old.scarfMissing||[]).filter(function(id,i,list){return has(ids,id)&&!has(d.scarf,id)&&list.indexOf(id)===i;});d.scarfMissingAt={};d.scarfMissing.forEach(function(id){d.scarfMissingAt[id]=(old.scarfMissingAt&&old.scarfMissingAt[id])||date+'T00:00:00.000Z';});d.leaderEvents=(old.leaderEvents||[]).filter(function(e){return has(ids,e.studentId);}).map(function(e){return {id:e.id,studentId:e.studentId,createdAt:e.createdAt};});normalizeNewFields(d,old,date,ids);if(typeof old.updatedAt==='string') d.updatedAt=old.updatedAt;clean.days[date]=d; });
    return clean;
  }
  var sample=[];for(var i=1;i<=42;i++) sample.push({id:'student-'+pad(i),number:pad(i)});
  var state={roster:sample,days:{}}, mode='homework', selectedDate=today(), undoState=null, storageOkay=true, toastTimer, activeModal=null, returnFocus=null, scoreStudentId=null, scarfStudentId=null, homeworkStudentId=null;
  try { var saved=localStorage.getItem(KEY);if(saved){var parsed=JSON.parse(saved);if(validState(parsed))state=normalize(parsed);else storageOkay=false;} } catch(error) {storageOkay=false;}
  function day() { if(!state.days[selectedDate]) state.days[selectedDate]={homework:[],scarf:[],duty:[],assigned:[],drawn:[],scarfMissing:[],scarfMissingAt:{},leaderEvents:[],answerEvents:[],homeworkMissing:[],homeworkMissingAt:{},homeworkMakeup:{},dutyRewardAt:{},roster:copyRoster(state.roster)};return state.days[selectedDate]; }
  function recorded(d) {return !!d.updatedAt || FIELDS.some(function(k){return d[k].length>0;}) || d.scarfMissing.length>0 || d.leaderEvents.length>0 || d.answerEvents.length>0 || d.homeworkMissing.length>0;}
  function transactions(d,id,date){
    var events=d.leaderEvents.filter(function(e){return e.studentId===id;}).map(function(e){return {stamp:e.createdAt,delta:1,label:'小组长 +1'};});
    var answers=d.answerEvents.filter(function(e){return e.studentId===id;}).sort(function(a,b){return a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);});
    answers.forEach(function(e,i){if(i%2===1)events.push({stamp:e.createdAt,delta:1,label:'回答2题 +1'});});
    if(d.dutyRewardAt[id])events.push({stamp:d.dutyRewardAt[id],delta:1,label:'完成值日 +1'});
    if(has(d.scarfMissing,id))events.push({stamp:d.scarfMissingAt[id],delta:-1,label:'未戴红领巾 -1'});
    if(has(d.homeworkMissing,id)){events.push({stamp:d.homeworkMissingAt[id],delta:-2,label:'作业未交 -2'});var m=d.homeworkMakeup[id];if(m&&m.submittedOn===date)events.push({stamp:m.createdAt,delta:1,label:'当天补交 +1'});}
    return events.sort(function(a,b){return a.stamp.localeCompare(b.stamp)||a.delta-b.delta;});
  }
  function dailyPoints(d,id){return transactions(d,id,selectedDate).reduce(function(sum,e){return sum+e.delta;},0);}
  function dayTotals(d,date){var totals={plus:0,minus:0,count:0};d.roster.forEach(function(s){transactions(d,s.id,date).forEach(function(e){totals.count++;if(e.delta>0)totals.plus+=e.delta;else totals.minus-=e.delta;});});return totals;}
  function pointStats(id){var stats={total:INITIAL_POINTS,peak:INITIAL_POINTS};Object.keys(state.days).filter(function(date){return date<=selectedDate;}).sort().forEach(function(date){transactions(state.days[date],id,date).forEach(function(e){stats.total=Math.max(0,stats.total+e.delta);stats.peak=Math.max(stats.peak,stats.total);});});return stats;}
  function totalPoints(id){return pointStats(id).total;}
  function growth(id){var stats=pointStats(id),levels=[{score:50,name:'启程章'},{score:55,name:'勤学章'},{score:60,name:'担当章'},{score:70,name:'榜样章'}],level=0;for(var i=0;i<levels.length;i++){if(stats.peak>=levels[i].score)level=i;}return {level:levels[level].name,next:level<levels.length-1?levels[level+1]:null,stats:stats};}

  function signed(value){return value>0?'+'+value:String(value);}
  function scarfState(d,id){return has(d.scarf,id)?'worn':has(d.scarfMissing,id)?'missing':'unknown';}
  function setScarf(status){
    remember();var d=day(),previousStamp=d.scarfMissingAt[scarfStudentId];delete d.scarfMissingAt[scarfStudentId];d.scarf=d.scarf.filter(function(id){return id!==scarfStudentId;});d.scarfMissing=d.scarfMissing.filter(function(id){return id!==scarfStudentId;});if(status==='worn')d.scarf.push(scarfStudentId);if(status==='missing'){d.scarfMissing.push(scarfStudentId);d.scarfMissingAt[scarfStudentId]=previousStamp||new Date().toISOString();}save();closeModal();render();notify(status==='missing'?'已记录未戴红领巾，当天扣1分（不重复扣分）':'已更新状态，该日不扣红领巾分');
  }
  function openScarf(id){var student=day().roster.filter(function(s){return s.id===id;})[0];scarfStudentId=id;$('scarf-student').textContent=student.number+'号 · '+selectedDate;var status=scarfState(day(),id);$('scarf-current').textContent='当前：'+(status==='worn'?'已戴':status==='missing'?'未戴，已扣1分':'未登记，不扣分');showModal('scarf-dialog');}
  function renderScoreDetail(){
    var d=day(),student=d.roster.filter(function(s){return s.id===scoreStudentId;})[0];if(!student)return;
    $('score-student').textContent=student.number+'号 · 积分记录';$('score-date').textContent='登记日期：'+selectedDate;$('score-total').textContent=String(totalPoints(student.id))+' 分';$('score-daily').textContent=(totalPoints(student.id)===0?'已到0分，老师来助力。':'')+'当日 '+signed(dailyPoints(d,student.id))+' 分 · 累计截至所选日期';var earned=growth(student.id);$('score-badge').textContent=earned.level;$('score-next').textContent=earned.next?'再积 '+Math.max(0,earned.next.score-earned.stats.total)+' 分，点亮'+earned.next.name:'四枚成长印章已点亮！';clear($('score-entries'));
    var events=d.leaderEvents.filter(function(e){return e.studentId===student.id;});events.forEach(function(e){var row=el('div','score-entry'),text=el('span','','当一次小组长 +1'),remove=el('button','text-button','撤销此条');remove.type='button';remove.setAttribute('aria-label','撤销该次小组长加分');remove.addEventListener('click',function(){remember();day().leaderEvents=day().leaderEvents.filter(function(item){return item.id!==e.id;});save();render();renderScoreDetail();notify('已撤销该次小组长加分');});append(row,[text,remove]);$('score-entries').appendChild(row);});
    var answers=d.answerEvents.filter(function(e){return e.studentId===student.id;});$('answer-progress').textContent='当天已回答 '+answers.length+' 题，已加 '+Math.floor(answers.length/2)+' 分'+(answers.length%2?'；再回答1题可加1分':'；每2题加1分，不跨天累计');
    $('answer-undo').disabled=!answers.length;
    transactions(d,student.id,selectedDate).filter(function(e){return e.label!=='小组长 +1';}).forEach(function(e){$('score-entries').appendChild(el('p',e.delta<0?'score-deduction':'',e.label));});
    var makeup=d.homeworkMakeup[student.id];if(makeup&&makeup.submittedOn!==selectedDate)$('score-entries').appendChild(el('p','','已于 '+makeup.submittedOn+' 补交，不返分'));
    if(!transactions(d,student.id,selectedDate).length)$('score-entries').appendChild(el('p','','当天还没有加扣分记录。'));

  }
  function openScore(id){scoreStudentId=id;renderScoreDetail();showModal('score-dialog');}
  function renderPoints(){
    var d=day(),net=0;clear($('students'));d.roster.forEach(function(s){var total=totalPoints(s.id),b=el('button','student points-student'+(total===0?' negative':''));net+=total;b.id='card-'+s.id;b.type='button';b.setAttribute('aria-label',s.number+'号，累计'+total+'分，点击登记积分');append(b,[el('span','number',s.number+'号'),el('strong','point-balance',String(total)),el('span','point-level',growth(s.id).level),el('span','state',total===0?'老师来助力':'当日 '+signed(dailyPoints(d,s.id)))]);b.addEventListener('click',function(){openScore(s.id);});$('students').appendChild(b);});
    var totals=dayTotals(d,selectedDate);
    $('class-count').textContent='累计截至 '+selectedDate;$('legend-text').textContent='点学号登记小组长、回答问题；积分榜按累计分数排序';$('summary-tag').textContent='积分';$('done-count').textContent=String(net);$('count-description').textContent='全班积分（含初始50分/人）';$('pending-description').textContent='当日加分 / 扣分';$('pending-count').textContent='+'+totals.plus+' / -'+totals.minus;
    $('pending-title').textContent='当日积分明细';$('pending-badge').textContent=totals.count+' 条';clear($('pending-names'));
    d.roster.forEach(function(s){transactions(d,s.id,selectedDate).forEach(function(e){$('pending-names').appendChild(el('span',e.delta<0?'missing-label':'',s.number+'号 · '+e.label));});});
    if(!totals.count)$('pending-names').appendChild(el('p','','当天尚无加扣分记录。'));
    renderLeaderboard();
  }
  function renderLeaderboard(){
    var ranked=day().roster.map(function(s){return {id:s.id,number:s.number,score:totalPoints(s.id)};}).sort(function(a,b){return b.score-a.score||Number(a.number)-Number(b.number);}),rank=0,last=null,shown=0;
    clear($('leaderboard-body'));ranked.forEach(function(s,i){if(s.score!==last)rank=i+1;last=s.score;if(rank>20)return;shown++;var row=el('tr',rank<=3?'top-rank':'');append(row,[el('td','','第'+rank+'名'),el('td','',s.number+'号'),el('td','',s.score+' 分')]);$('leaderboard-body').appendChild(row);});
    $('leaderboard-note').textContent='截至 '+selectedDate+' · '+shown+' 人上榜。分数相同并列，第20名同分一同上榜。';
  }
  function openHomework(id){homeworkStudentId=id;var d=day(),student=d.roster.filter(function(s){return s.id===id;})[0],m=d.homeworkMakeup[id],missing=has(d.homeworkMissing,id);$('homework-student').textContent=student.number+'号 · '+selectedDate;$('homework-current').textContent=m?'已于 '+m.submittedOn+' 补交，'+(m.submittedOn===selectedDate?'返1分，净扣1分':'不返分，仍扣2分'):missing?'未交，已扣2分':has(d.homework,id)?'按时已交，不扣分':'未登记，不扣分';$('homework-ontime').hidden=missing;$('homework-missing').hidden=missing;$('homework-makeup').hidden=!missing||!!m;$('homework-makeup').disabled=selectedDate>today();$('homework-makeup').textContent=selectedDate===today()?'今天补交 · 返1分':'现在补交 · 不返分';$('homework-correct').hidden=!missing;$('homework-unknown').hidden=missing;showModal('homework-dialog');}
  function setHomework(action){
    var d=day(),id=homeworkStudentId;if(!id)return;
    if(action==='makeup'&&(!has(d.homeworkMissing,id)||d.homeworkMakeup[id]||selectedDate>today()))return;
    if((action==='ontime'||action==='unknown')&&has(d.homeworkMissing,id))return;
    if(action==='correct'&&!window.confirm('仅用于更正误记：撤销该日作业未交及补交计分，改为未登记。实际补交请取消并点“补交”。'))return;
    remember();if(action==='missing'){if(!has(d.homeworkMissing,id)){d.homeworkMissing.push(id);d.homeworkMissingAt[id]=new Date().toISOString();}d.homework=d.homework.filter(function(x){return x!==id;});}
    else if(action==='makeup'){d.homeworkMakeup[id]={submittedOn:today(),createdAt:new Date().toISOString()};if(!has(d.homework,id))d.homework.push(id);}
    else {d.homework=d.homework.filter(function(x){return x!==id;});if(action==='ontime')d.homework.push(id);if(action==='correct'){d.homeworkMissing=d.homeworkMissing.filter(function(x){return x!==id;});delete d.homeworkMissingAt[id];delete d.homeworkMakeup[id];}}
    save();closeModal();render();notify(action==='makeup'?(selectedDate===today()?'当天补交返1分，该项净扣1分':'已记录隔日补交，不返分'):'作业状态已更新');
  }
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
      var totals=dayTotals(d,date),pointsMetric=el('div');append(pointsMetric,[el('span','','当日积分'),el('strong','','+'+totals.plus+' / -'+totals.minus)]);metrics.appendChild(pointsMetric);
      var helper=d.roster.filter(function(s){return s.id===d.drawn[d.drawn.length-1];})[0];
      var extra=el('p','history-helper','小助手：'+(helper?helper.number+'号':'未抽取')),view=el('button','quiet-button','查看当天');view.type='button';view.setAttribute('aria-label','查看'+date+'的登记状态');view.addEventListener('click',function(){selectDate(date);$('task-panel').scrollIntoView(true);focus($('date'));});
      append(row,[heading,metrics,extra,view]);$('history-list').appendChild(row);
    });
  }
  function render() {
    var d=day(),cfg=MODES[mode],students=rosterForMode(),isPoints=mode==='points',done=isPoints?[]:students.filter(function(s){return has(d[mode],s.id);}),pending=isPoints?[]:students.filter(function(s){return !has(d[mode],s.id);});
    $('viewing-date').textContent=selectedDate===today()?'正在登记今天 · '+selectedDate:'正在查看 '+selectedDate+' · 修改会更新该日记录';$('back-today').hidden=selectedDate===today();
    all('[data-mode]').forEach(function(b){var selected=b.getAttribute('data-mode')===mode;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    $('task-panel').setAttribute('aria-labelledby','tab-'+mode);$('task-title').textContent=cfg.title;$('task-hint').textContent=cfg.hint;
    $('class-count').textContent=(mode==='duty'?'当天值日 ':'全班 ')+students.length+' 人';$('duty-open').hidden=mode!=='duty';$('all-done').hidden=isPoints;$('batch-open').disabled=!students.length;$('leaderboard').hidden=!isPoints;$('growth-trail').hidden=!isPoints;$('summary-denominator').hidden=isPoints;$('task-progress').hidden=isPoints;$('all-done').textContent='全部'+cfg.done;$('all-done').disabled=!pending.length;$('undo').disabled=!undoState;
    clear($('students'));
    students.forEach(function(s){
      if(isPoints)return;
      var checked=has(d[mode],s.id),missing=(mode==='scarf'&&has(d.scarfMissing,s.id))||(mode==='homework'&&has(d.homeworkMissing,s.id)&&!checked),status=mode==='homework'&&d.homeworkMakeup[s.id]?'已补交':checked?cfg.done:missing?(mode==='homework'?'未交 -2':'未戴 -1'):cfg.pending,b=el('button','student'+(checked?' done':missing?' missing':''));b.type='button';b.id='card-'+s.id;if(mode==='duty')b.setAttribute('aria-pressed',String(checked));b.setAttribute('aria-label',s.number+'号，'+status+'，点击'+(mode==='scarf'?'选择红领巾状态':mode==='homework'?'选择作业状态':checked?'撤回':'标记'+cfg.done));
      append(b,[el('span','number','学号'),el('span','student-number',s.number+'号'),el('span','state',status),el('span','tick',missing?'−':'✓')]);
      b.addEventListener('click',function(){if(mode==='scarf'){openScarf(s.id);return;}if(mode==='homework'){openHomework(s.id);return;}remember();var list=day()[mode];day()[mode]=has(list,s.id)?list.filter(function(id){return id!==s.id;}):list.concat([s.id]);if(mode==='duty'){if(has(day().duty,s.id))day().dutyRewardAt[s.id]=new Date().toISOString();else delete day().dutyRewardAt[s.id];}save();render();focus($('card-'+s.id));});$('students').appendChild(b);
    });
    if(!students.length){var empty=el('div','empty'),arrange=el('button','primary-button','安排当天的值日生');empty.appendChild(el('div','','当天还没有安排值日生'));arrange.onclick=openDuty;empty.appendChild(arrange);$('students').appendChild(empty);}
    $('legend-text').textContent='打勾表示'+cfg.done;$('summary-tag').textContent=cfg.label;$('done-count').textContent=done.length;$('total-count').textContent=students.length;$('count-description').textContent=cfg.desc;
    var percent=students.length?Math.round(done.length/students.length*100):0;$('progress-fill').style.width=percent+'%';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(percent));
    $('pending-description').textContent=cfg.pending;$('pending-count').textContent=pending.length+' 人';$('pending-title').textContent=cfg.pendingTitle;$('pending-badge').textContent=pending.length+' 人';clear($('pending-names'));
    if(pending.length)pending.forEach(function(s){var missing=mode==='scarf'&&has(d.scarfMissing,s.id);$('pending-names').appendChild(el('span',missing?'missing-label':'',s.number+'号'+(mode==='scarf'?(missing?' · 未戴 -1':' · 未登记'):'')));});else $('pending-names').appendChild(el('p','',students.length?'全部完成，真棒！ ✓':'安排值日生后，这里会显示待完成学号。'));
    if(mode==='scarf'){$('pending-description').textContent='未戴 / 未登记';$('pending-count').textContent=d.scarfMissing.length+' / '+(pending.length-d.scarfMissing.length)+' 人';}
    var helper=d.roster.filter(function(s){return s.id===d.drawn[d.drawn.length-1];})[0];$('helper-name').textContent=helper?helper.number+'号':'会是谁呢？';$('helper-note').textContent=helper?'已当选 · 再抽一位也可以':'从当日全班同学中随机抽取';$('draw').firstChild.nodeValue=helper?'再抽一位小助手 ':'抽一位小助手 ';
    if(isPoints)renderPoints();updateSaveStatus();renderHistory();
  }
  $('date').value=selectedDate;$('date').setAttribute('placeholder','YYYY-MM-DD');
  if($('date').type==='text')$('date').setAttribute('title','请输入日期，例如 2026-09-13');
  $('date').addEventListener('change',function(){var value=$('date').value;if(!validDate(value)){notify('请输入有效日期，格式为 YYYY-MM-DD');$('date').value=selectedDate;return;}selectDate(value);});
  $('back-today').addEventListener('click',function(){selectDate(today());});
  all('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.getAttribute('data-mode');render();});b.addEventListener('keydown',function(e){var keys=['homework','scarf','duty','points'],i=keys.indexOf(mode),k=e.keyCode;if(k===39)i=(i+1)%4;else if(k===37)i=(i+3)%4;else if(k===36)i=0;else if(k===35)i=3;else return;e.preventDefault();mode=keys[i];render();focus($('tab-'+mode));});});
  function batchIds(){return all('input:checked',$('batch-options')).map(function(x){return x.value;});}
  function updateBatchCount(){var count=batchIds().length;$('batch-count').textContent='已选 '+count+' 人';all('button',$('batch-actions')).forEach(function(b){b.disabled=!count;});}
  function chooseBatch(kind){all('input',$('batch-options')).forEach(function(input){input.checked=kind==='all'||(kind==='pending'&&mode!=='points'&&!has(day()[mode],input.value));});updateBatchCount();}
  function openBatch(){
    $('batch-title').textContent=MODES[mode].label+' · 批量登记';$('batch-date').textContent='登记日期：'+selectedDate;
    $('batch-hint').textContent=mode==='homework'?'先全选，再取消少数例外，或点“全不选”只勾选要处理的学号。已记未交者标为已交时按补交计分；已补交者不会重复返分。':mode==='scarf'?'选择未戴的同学一起登记扣分；已戴或未登记会撤回原来的红领巾扣分。':mode==='duty'?'只处理当天已安排的值日生。完成加1分，重复登记不重复加分。':'勾选参与的同学，再一起登记回答问题或小组长任务。每次点击记一次，请勿重复提交。';
    clear($('batch-options'));clear($('batch-actions'));
    rosterForMode().forEach(function(student){var label=el('label'),input=el('input');input.type='checkbox';input.value=student.id;input.checked=mode!=='points';input.addEventListener('change',updateBatchCount);append(label,[input,document.createTextNode(student.number+'号')]);$('batch-options').appendChild(label);});
    var actions=mode==='homework'?[['done','标记已交 / 补交'],['missing','确认未交 · 每人扣2分']]:mode==='scarf'?[['done','标记已戴'],['missing','确认未戴 · 每人扣1分'],['unknown','改为未登记']]:mode==='duty'?[['done','标记完成 · 每人加1分'],['unknown','撤回完成状态']]:[['answer','每人回答了1题'],['leader','每人当了1次小组长']];
    actions.forEach(function(action,i){var button=el('button',i===0?'primary-button':'quiet-button',action[1]);button.id='batch-'+action[0];button.type='button';button.addEventListener('click',function(){runBatch(action[0],batchIds());});$('batch-actions').appendChild(button);});
    $('batch-pending').hidden=mode==='points';updateBatchCount();showModal('batch-dialog');
  }
  function runBatch(action,ids){
    var d=day(),eligible=rosterForMode().map(function(student){return student.id;});ids=ids.filter(function(id,i,list){return has(eligible,id)&&list.indexOf(id)===i;});if(!ids.length)return;
    var changed=0,skipped=0,makeups=0,stamp=new Date().toISOString(),localToday=today(),before=copy(d),previousUndo=undoState;
    if(mode==='points'){var field=action==='answer'?'answerEvents':'leaderEvents';if(d[field].length+ids.length>2000){notify('当天记录空间不足，未作修改');return;}}
    remember();ids.forEach(function(id){
      if(mode==='homework'){
        if(action==='done'){
          if(has(d.homework,id))return;
          if(has(d.homeworkMissing,id)){
            if(selectedDate>localToday){skipped++;return;}
            if(!d.homeworkMakeup[id]){d.homeworkMakeup[id]={submittedOn:localToday,createdAt:stamp};makeups++;}
          }
          d.homework.push(id);changed++;
        }else if(action==='missing'){
          if(has(d.homeworkMissing,id)){if(d.homeworkMakeup[id])skipped++;return;}
          d.homework=d.homework.filter(function(x){return x!==id;});d.homeworkMissing.push(id);d.homeworkMissingAt[id]=stamp;changed++;
        }
      }else if(mode==='scarf'){
        var target=action==='done'?'worn':action==='missing'?'missing':'unknown';if(scarfState(d,id)===target)return;
        d.scarf=d.scarf.filter(function(x){return x!==id;});d.scarfMissing=d.scarfMissing.filter(function(x){return x!==id;});delete d.scarfMissingAt[id];
        if(target==='worn')d.scarf.push(id);if(target==='missing'){d.scarfMissing.push(id);d.scarfMissingAt[id]=stamp;}changed++;
      }else if(mode==='duty'){
        if(action==='done'){if(has(d.duty,id))return;d.duty.push(id);d.dutyRewardAt[id]=stamp;changed++;}
        else {if(!has(d.duty,id))return;d.duty=d.duty.filter(function(x){return x!==id;});delete d.dutyRewardAt[id];changed++;}
      }else if(mode==='points'){
        var key=action==='answer'?'answerEvents':'leaderEvents';d[key].push({id:action+'-'+new Date().getTime()+'-'+id+'-'+Math.random().toString(36).slice(2),studentId:id,createdAt:stamp});changed++;
      }
    });
    if(!changed){state.days[selectedDate]=before;undoState=previousUndo;notify('没有需要更新的状态'+(skipped?'；已补交或未来日期的记录已跳过':''));return;}
    save();closeModal();render();notify('已批量更新 '+changed+' 人'+(makeups?'，其中 '+makeups+' 人按'+(selectedDate===localToday?'当天补交返1分':'隔日补交不返分'):'')+(skipped?'；跳过 '+skipped+' 人':'')+'。误操作可撤销整批');
  }
  $('batch-open').addEventListener('click',openBatch);
  $('batch-all').addEventListener('click',function(){chooseBatch('all');});
  $('batch-none').addEventListener('click',function(){chooseBatch('none');});
  $('batch-pending').addEventListener('click',function(){chooseBatch('pending');});
  $('all-done').addEventListener('click',function(){if(mode==='points')return;runBatch('done',rosterForMode().map(function(student){return student.id;}));});
  $('duty-select-all').addEventListener('click',function(){all('input',$('duty-options')).forEach(function(input){input.checked=true;});});
  $('duty-select-none').addEventListener('click',function(){all('input',$('duty-options')).forEach(function(input){input.checked=false;});});
  all('[data-scarf-state]').forEach(function(b){b.addEventListener('click',function(){setScarf(b.getAttribute('data-scarf-state'));});});
  all('[data-homework-action]').forEach(function(b){b.addEventListener('click',function(){setHomework(b.getAttribute('data-homework-action'));});});
  $('answer-add').addEventListener('click',function(){if(!scoreStudentId||day().answerEvents.length>=2000){notify('当天回答记录已满');return;}remember();day().answerEvents.push({id:'answer-'+new Date().getTime()+'-'+Math.random().toString(36).slice(2),studentId:scoreStudentId,createdAt:new Date().toISOString()});save();render();renderScoreDetail();notify('已登记回答1题，每2题自动加1分');});
  $('answer-undo').addEventListener('click',function(){var list=day().answerEvents,index=-1;list.forEach(function(e,i){if(e.studentId===scoreStudentId)index=i;});if(index<0)return;remember();list.splice(index,1);save();render();renderScoreDetail();notify('已撤销最近1题，积分已重算');});
  $('leader-add').addEventListener('click',function(){if(!scoreStudentId)return;if(day().leaderEvents.length>=2000){notify('当天记录已满，请检查重复登记');return;}remember();day().leaderEvents.push({id:'leader-'+new Date().getTime()+'-'+Math.random().toString(36).slice(2),studentId:scoreStudentId,createdAt:new Date().toISOString()});save();render();renderScoreDetail();$('score-badge').className='earned-seal stamp-pop';setTimeout(function(){$('score-badge').className='earned-seal';},650);notify('小组长任务完成，积分 +1！');});
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
    var ids=state.roster.map(function(s){return s.id;});day().roster=copyRoster(state.roster);FIELDS.forEach(function(k){day()[k]=day()[k].filter(function(id){return has(ids,id);});});day().scarfMissing=day().scarfMissing.filter(function(id){return has(ids,id);});day().leaderEvents=day().leaderEvents.filter(function(e){return has(ids,e.studentId);});Object.keys(day().scarfMissingAt).forEach(function(id){if(!has(ids,id))delete day().scarfMissingAt[id];});normalizeNewFields(day(),copy(day()),selectedDate,ids);Object.keys(state.days).forEach(function(date){if(!recorded(state.days[date]))state.days[date].roster=copyRoster(state.roster);});
    save();closeModal();render();notify('学号已更新，其他已保存日期保持不变');
  });
  function openDuty(){clear($('duty-options'));day().roster.forEach(function(s){var label=el('label'),input=el('input');input.type='checkbox';input.value=s.id;input.checked=has(day().assigned,s.id);append(label,[input,document.createTextNode(s.number+'号')]);$('duty-options').appendChild(label);});showModal('duty-dialog');}
  $('duty-open').addEventListener('click',openDuty);
  $('duty-form').addEventListener('submit',function(e){e.preventDefault();remember();day().assigned=all('input:checked',$('duty-options')).map(function(x){return x.value;});day().duty=day().duty.filter(function(id){return has(day().assigned,id);});Object.keys(day().dutyRewardAt).forEach(function(id){if(!has(day().duty,id))delete day().dutyRewardAt[id];});save();closeModal();render();notify('当天值日已安排');});
  function randomIndex(length){var rng=window.crypto||window.msCrypto;if(rng&&rng.getRandomValues){var range=4294967296,limit=Math.floor(range/length)*length,a=new Uint32Array(1);do{rng.getRandomValues(a);}while(a[0]>=limit);return a[0]%length;}return Math.floor(Math.random()*length);}
  $('draw').addEventListener('click',function(){remember();var d=day(),pool=d.roster.filter(function(s){return !has(d.drawn,s.id);}),newRound=!pool.length;if(newRound){d.drawn=[];pool=d.roster;}var winner=pool[randomIndex(pool.length)];d.drawn.push(winner.id);save();render();$('winner').textContent=winner.number+'号';showModal('helper-dialog');if(newRound)notify('全班都当选过啦，开始新一轮');});
  function backupPayload(){var data=copy(state);Object.keys(data.days).forEach(function(date){if(!recorded(data.days[date]))delete data.days[date];});return {app:'tianyi-class-helper',schemaVersion:3,className:'天翊班',exportedAt:new Date().toISOString(),data:data};}
  $('export-backup').addEventListener('click',function(){
    save();render();var payload=backupPayload(),filename='tianyi-class-records-'+today()+'.json';
    try{var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});if(navigator.msSaveOrOpenBlob){if(navigator.msSaveOrOpenBlob(blob,filename)===false)throw new Error('download');}else{var url=(window.URL||window.webkitURL).createObjectURL(blob),a=el('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){(window.URL||window.webkitURL).revokeObjectURL(url);},60000);}$('backup-status').textContent='已发起下载，包含 '+Object.keys(payload.data.days).length+' 天记录。请在浏览器中完成保存。';}catch(error){$('backup-status').textContent='当前浏览器未能下载。请用手机系统浏览器或电脑浏览器打开此网址后重试。';}
  });
  $('import-backup').addEventListener('click',function(){$('backup-file').value='';$('backup-file').click();});
  $('backup-file').addEventListener('change',function(){
    var file=this.files&&this.files[0];if(!file)return;if(file.size>10*1024*1024){$('backup-status').textContent='备份文件过大，请选择本工具导出的 JSON 文件（10 MB 以内）。';return;}
    var reader=new FileReader();reader.onerror=function(){$('backup-status').textContent='文件读取失败，请重新选择。';};reader.onload=function(){
      var incoming;
      try{var payload=JSON.parse(String(reader.result).replace(/^\uFEFF/,''));if(!payload||payload.app!=='tianyi-class-helper'||(payload.schemaVersion!==1&&payload.schemaVersion!==2&&payload.schemaVersion!==3)||!validState(payload.data))throw new Error('invalid');incoming=normalize(payload.data);}catch(error){$('backup-status').textContent='文件不是有效的天翊班备份，现有记录未修改。';return;}
      var dates=Object.keys(incoming.days),conflicts=dates.filter(function(date){return state.days[date]&&recorded(state.days[date]);});
      if(!window.confirm('备份含 '+dates.length+' 天记录，将合并到当前浏览器。'+(conflicts.length?'其中 '+conflicts.length+' 个同日期的记录将以备份为准。':'')+'默认学号也会恢复为备份中的设置。是否继续？'))return;
      var merged=copy(state);merged.roster=copyRoster(incoming.roster);dates.forEach(function(date){merged.days[date]=incoming.days[date];});if(Object.keys(merged.days).length>5000){$('backup-status').textContent='合并后超过 5000 天记录，现有记录未修改。';return;}
      remember();state=merged;Object.keys(state.days).forEach(function(date){if(!recorded(state.days[date]))state.days[date].roster=copyRoster(state.roster);});var ok=persist();render();$('backup-status').textContent=ok?'已恢复 '+dates.length+' 天记录，可在历史记录中查看。误操作可点“撤销”。':'已读取备份，但浏览器无法保存。请保留原备份文件，勿清理或关闭当前页面。';
    };reader.readAsText(file,'UTF-8');
  });
  render();if(!storageOkay)notify('浏览器记录未能读取；可使用本机备份恢复');
}());
