(function () {
  'use strict';
  var KEY='tianyi-access-lock-v1', current={salt:'',hash:''}, readError=false;
  function $(id){return document.getElementById(id);}
  /* SHA-256 in ES5 for the local access lock, including IE11. This does not encrypt records. */
  function sha256(text){
    var utf8=unescape(encodeURIComponent(text)), bytes=[], i, j, p=2, primes=0, H=[], K=[];
    while(primes<64){var prime=true;for(j=2;j*j<=p;j++){if(p%j===0){prime=false;break;}}if(prime){if(primes<8)H.push((Math.pow(p,0.5)%1*4294967296)>>>0);K.push((Math.pow(p,1/3)%1*4294967296)>>>0);primes++;}p++;}
    for(i=0;i<utf8.length;i++)bytes.push(utf8.charCodeAt(i));var bitLength=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);bytes.push(0,0,0,0,(bitLength>>>24)&255,(bitLength>>>16)&255,(bitLength>>>8)&255,bitLength&255);
    function rotr(x,n){return (x>>>n)|(x<<(32-n));}
    for(var offset=0;offset<bytes.length;offset+=64){
      var w=[];for(i=0;i<16;i++){j=offset+i*4;w[i]=(bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3];}
      for(i=16;i<64;i++){var s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for(i=0;i<64;i++){var upper=rotr(e,6)^rotr(e,11)^rotr(e,25),choice=(e&f)^(~e&g),t1=(h+upper+choice+K[i]+w[i])|0,lower=rotr(a,2)^rotr(a,13)^rotr(a,22),majority=(a&b)^(a&c)^(b&c),t2=(lower+majority)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
      var end=[a,b,c,d,e,f,g,h];for(i=0;i<8;i++)H[i]=(H[i]+end[i])>>>0;
    }
    return H.map(function(v){return ('00000000'+v.toString(16)).slice(-8);}).join('');
  }
  current.hash=sha256('1024:');
  var saved=null;try{saved=localStorage.getItem(KEY);}catch(error){saved=null;}
  if(saved){try{var parsed=JSON.parse(saved);if(!parsed||typeof parsed.salt!=='string'||!/^\w{0,80}$/.test(parsed.salt)||typeof parsed.hash!=='string'||!/^\w{64}$/.test(parsed.hash))throw new Error('invalid');current={salt:parsed.salt,hash:parsed.hash};}catch(error){readError=true;}}
  function matches(value){try{return sha256(value+':'+current.salt)===current.hash;}catch(error){return false;}}
  function clearPasswords(){['login-password','old-password','new-password','confirm-password'].forEach(function(id){$(id).value='';});}
  function lock(){
    Array.prototype.slice.call(document.querySelectorAll('.modal')).forEach(function(modal){if(!modal.hidden){var button=modal.querySelector('[data-close]');if(button)button.click();}});
    $('app-shell').hidden=true;$('login-screen').hidden=false;$('login-error').textContent='';clearPasswords();
    Array.prototype.slice.call(document.querySelectorAll('.modal')).forEach(function(modal){modal.hidden=true;});$('modal-backdrop').hidden=true;document.body.style.overflow='';$('login-password').focus();
  }
  $('login-form').addEventListener('submit',function(event){event.preventDefault();if(readError){$('login-error').textContent='无法读取本机密码设置，请检查浏览器是否允许本机存储。';return;}if(!matches($('login-password').value)){$('login-error').textContent='密码不正确，请重新输入。';$('login-password').value='';$('login-password').focus();return;}$('login-screen').hidden=true;$('app-shell').hidden=false;clearPasswords();$('login-error').textContent='';$('date').focus();});
  $('lock-app').addEventListener('click',lock);
  $('password-form').addEventListener('submit',function(event){
    event.preventDefault();var value=$('new-password').value;
    if(!matches($('old-password').value)){$('password-error').textContent='当前密码不正确。';return;}
    if(value.length<4||value.length>64||!value.replace(/\s/g,'')){$('password-error').textContent='新密码请填写 4—64 位字符，不能全是空格。';return;}
    if(value!==$('confirm-password').value){$('password-error').textContent='两次输入的新密码不一致。';return;}
    var rng=window.crypto||window.msCrypto,values=new Uint32Array(4);if(rng&&rng.getRandomValues)rng.getRandomValues(values);else for(var i=0;i<4;i++)values[i]=Math.floor(Math.random()*4294967296);
    var salt='';for(var j=0;j<4;j++)salt+=values[j].toString(16);var next;
    try{next={salt:salt,hash:sha256(value+':'+salt)};localStorage.setItem(KEY,JSON.stringify(next));}catch(error){$('password-error').textContent='浏览器无法保存新密码，原密码仍然有效。';return;}
    current=next;lock();$('login-error').textContent='密码已修改，请使用新密码登录。';
  });
  /* Always show the lock when restored from mobile browser back/forward cache. */
  window.addEventListener('pageshow',function(event){if(event.persisted)lock();});
}());
