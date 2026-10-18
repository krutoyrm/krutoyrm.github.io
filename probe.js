/* Temporary read-only SISI image diagnostic. No titles, playback or account settings. */
(function(){
 'use strict';
 if(window.sisiProbeActive)return;
 window.sisiProbeActive=true;
 function report(d){try{var n=new Lampa.Reguest();n.timeout(5000);n.native('http://127.0.0.1:18766/report?d='+encodeURIComponent(JSON.stringify(d)),function(){},function(){},false,{dataType:'text'});}catch(e){console.log('SisiProbe',e.message);}}
 function snapshot(){
  var a=Lampa.Activity.active(),images=Array.prototype.map.call(document.querySelectorAll('.activity--active .card__img'),function(x){return {src:x.getAttribute('src'),width:x.naturalWidth,complete:x.complete,outer:x.outerHTML.slice(0,500)};}).slice(0,8);
  report({type:'dom',origin:location.origin,component:a&&a.activity&&a.activity.component,images:images});
 }
 window.sisiProbeReport=report;
 window.sisiProbeSnapshot=snapshot;
 document.addEventListener('error',function(e){if(e.target&&e.target.tagName==='IMG')report({type:'imgerror',src:e.target.src});},true);
 var timer=setInterval(snapshot,10000);
 window.sisiStopProbe=function(){clearInterval(timer);window.sisiProbeActive=false;};
 setTimeout(window.sisiStopProbe,600000);
 // Remove only the temporary local diagnostic entry created during this investigation.
 var plugins=Lampa.Storage.get('plugins',[]);
 if(Array.isArray(plugins)){var filtered=plugins.filter(function(p){return !/^https?:\/\/192\.168\.1\.17:18765\/probe\.js$/.test(typeof p==='string'?p:p.url);});if(filtered.length!==plugins.length)Lampa.Storage.set('plugins',filtered);}
 report({type:'ready',userAgent:navigator.userAgent});
 snapshot();
}());
