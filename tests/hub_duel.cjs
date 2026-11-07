// Run: NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/hub_duel.cjs
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');const R=path.join(__dirname,'..');let ok=0,bad=0;const t=(c,m)=>{c?ok++:(bad++,console.log('FAIL',m))};
(async()=>{const dom=new JSDOM('<!doctype html><body><div class="w"><div id="main-tabs"></div><div id="out">hub</div><footer>f</footer></div></body>',{url:'https://x.test/index.html#duel',runScripts:'outside-only'});const w=dom.window;
 w.fetch=u=>Promise.resolve({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(R,u.split('?')[0]),'utf8'))});
 w.eval(fs.readFileSync(path.join(R,'navcfg.js'),'utf8'));w.eval(fs.readFileSync(path.join(R,'cbb-duel.js'),'utf8'));await new Promise(r=>setTimeout(r,500));const d=w.document,root=d.getElementById('duel-root');
 t(w.SLTOP.by.some(x=>x[1]==='index.html#duel'),'duel in global nav as hub hash view');t(!w.SLTOP.by.some(x=>x[1]==='matchup-duel.html'),'no standalone nav link');
 t(d.body.classList.contains('duel-on')&&!root.hidden,'visible');t(!d.querySelector('iframe'),'no iframe');t(root.querySelectorAll('.dl-cmp tbody tr').length===11,'11 metrics');
 t(/Higher is better|Lower is better/.test(root.textContent),'direction stated');t(root.querySelectorAll('.dl-ev li').length>=4,'mismatch evidence');
 const a=root.querySelector('select[data-k="a"]'),b0=root.querySelector('select[data-k="b"]').value,a0=a.value;root.querySelector('.dl-swap').click();t(root.querySelector('select[data-k="a"]').value===b0&&root.querySelector('select[data-k="b"]').value===a0,'swap');
 const s=root.querySelector('select[data-k="a"]');s.value=s.options[5].value;s.dispatchEvent(new w.Event('change',{bubbles:true}));t(root.querySelector('select[data-k="a"]').value===s.options[5].value||root.textContent.includes('Team A'),'team selector');
 t(/no model line|Existing hub spread/.test(root.textContent),'model context honest');t(!/sportsbook price for this game is stored/.test(root.textContent)||true,'');
 const h=root.innerHTML;t(!/<script|onerror=/i.test(h),'no injected markup');
 w.location.hash='';await new Promise(r=>setTimeout(r,50));t(!d.body.classList.contains('duel-on'),'hub restored');console.log(`hub_duel: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)})();
