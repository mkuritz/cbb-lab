/* CBB Hub in-page sidebar: builds window.SLNAV from this repo's SLTOP.by and mounts the repo's side.js.
   Section links that the Hub page renders in place (hash views) keep the user on index.html. */
(function(){'use strict';
function mount(){const C=window.SLTOP;if(!C||window.SLNAV)return;
 const items=C.by.map(x=>{const href=x[1],m=/^index\.html#(.+)$/.exec(href);return [x[0],href,m?'index#'+m[1]:href.replace(/\.html.*$/,'')]});
 window.SLNAV={key:'cbb-sidebar',groups:[['CBB Hub',items]]};
 const s=document.createElement('script');s.src='side.js?v=1106hub2';document.body.appendChild(s);document.body.classList.add('cbb-side')}
/* Hash views inside the hub: keep tabs in sync for sidebar / back / forward. */
function sync(){const h=location.hash.slice(1),b=document.querySelector('#main-tabs button[data-mt="'+(['upsets','segments','hurdles','class','sim'].includes(h)?h:'overview')+'"]');if(h!=='duel'&&b&&!b.classList.contains('on'))b.click()}
const css=document.createElement('style');css.textContent='body.cbb-side #v2bar nav.by{display:none}body.duel-on .w>h2{display:none}';document.head.appendChild(css);
addEventListener('hashchange',sync);
document.readyState==='complete'?mount():addEventListener('DOMContentLoaded',()=>setTimeout(mount,0));
})();
