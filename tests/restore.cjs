const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const port=5893,url=`http://127.0.0.1:${port}`;
const browserPath=process.env.HUIXIN_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
(async()=>{
 const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--configLoader','native','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true,stdio:'pipe'});
 let browser;
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
  assert.ok(ready,'isolated test server must start');
  browser=await chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('navigation').first().waitFor();
  const initial=await page.evaluate(async()=>{const{db}=await import('/src/data/db.ts');return{count:await db.collections.count(),meta:await db.meta.toArray()}});
  assert.equal(initial.count,0,'new profile must start empty');
  assert.ok(!initial.meta.some(x=>/personal|official-cover|official-introduction/.test(x.key)),'no private preset initializer runs');
  const id=await page.evaluate(async()=>{const{db,newCollection}=await import('/src/data/db.ts');const item={...newCollection('book'),title:'恢复验证作品',note:'只存在于隔离测试浏览器',loveLevel:'interest'};await db.collections.add(item);return item.id});
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('navigation').first().waitFor();
  const saved=await page.evaluate(async id=>{const{db}=await import('/src/data/db.ts');return db.collections.get(id)},id);
  assert.equal(saved.title,'恢复验证作品');assert.equal(saved.note,'只存在于隔离测试浏览器');assert.equal(saved.loveLevel,'interest');
  assert.equal(await page.evaluate(async()=>{const{db}=await import('/src/data/db.ts');return db.collections.count()}),1,'reload preserves existing collection without adding defaults');
  await page.goto(url+'/#/treasure',{waitUntil:'domcontentloaded'});await page.getByText('恢复验证作品',{exact:true}).first().waitFor();
  assert.deepEqual(errors,[],'no uncaught browser exceptions');
  await context.close();console.log('PASS restore: empty startup, no presets, persisted user fields, treasure route, no uncaught browser exceptions');
 }finally{if(browser)await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
