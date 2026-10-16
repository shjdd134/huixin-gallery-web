const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5896';
(async()=>{
 const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--configLoader','native','--host','127.0.0.1','--port','5896','--strictPort'],{cwd:root,windowsHide:true,stdio:'pipe'});
 let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready);
  const executablePath=process.env.HUIXIN_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.getByRole('navigation').first().waitFor();
  assert.equal(await page.locator('.desktop-nav a[href="#/website"]').count(),1,'website room must exist');
  assert.equal(await page.locator('a[href="#/music"],a[href="#/game"]').count(),0,'retired room links removed');
  await page.locator('.desktop-nav a[href="#/website"]').click();
  await page.getByRole('button',{name:'添加网站',exact:true}).click();
  await page.getByLabel('网站名称',{exact:true}).fill('测试工具站');
  await page.getByLabel('网站地址',{exact:true}).fill('example.org/tools');
  await page.getByLabel('网站用途',{exact:true}).fill('格式转换与文档整理');
  await page.getByRole('button',{name:'保存网站',exact:true}).click();
  await page.locator('.website-card').waitFor();
  assert.ok((await page.locator('.website-card').innerText()).includes('格式转换与文档整理'));
  assert.equal(await page.getByRole('link',{name:'打开网站',exact:true}).getAttribute('href'),'https://example.org/tools');
  assert.equal(await page.getByRole('link',{name:'打开网站',exact:true}).getAttribute('rel'),'noopener noreferrer');
  await page.reload({waitUntil:'networkidle'});await page.locator('.website-card').waitFor();
  await page.getByRole('button',{name:'查看 测试工具站',exact:true}).click();
  await page.getByRole('button',{name:'编辑收藏',exact:true}).click();
  await page.getByLabel('网站地址',{exact:true}).fill('https://example.org/updated');
  await page.getByLabel('网站用途',{exact:true}).fill('网页整理与资料检索');
  await page.getByRole('button',{name:'保存修改',exact:true}).click();
  await page.getByRole('dialog').getByRole('link',{name:'打开网站',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('link',{name:'打开网站',exact:true}).getAttribute('href'),'https://example.org/updated');
  await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'搜索收藏',exact:true}).click();
  await page.locator('#collection-search').fill('example.org/updated');
  await page.getByRole('dialog').getByRole('button',{name:/测试工具站/}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
  const result=await page.evaluate(async()=>{
   const {db,newCollection,saveCollection}=await import('/src/data/db.ts');
   const {createBackup,readBackup,restoreBackup}=await import('/src/data/backup.ts');
   const site=(await db.collections.toArray()).find(x=>x.space==='website');
   let rejected=0;for(const bad of ['javascript:alert(1)','data:text/html,test','file:///test']){try{await saveCollection({...newCollection('website'),title:'无效地址测试',url:bad})}catch{rejected++}}
   const a={...newCollection('music'),title:'保留的音乐测试'},b={...newCollection('game'),title:'保留的游戏测试'};
   await saveCollection(a);await saveCollection(b);
   const baseline=await db.collections.get(site.id);await saveCollection({...baseline,note:'并行更新的用途'},baseline);
   await saveCollection({...baseline,url:'https://example.org/final'},baseline);
   const merged=await db.collections.get(site.id);
   const blob=await createBackup();const bytes=Array.from(new Uint8Array(await blob.arrayBuffer()));
   const backup=await readBackup(blob);await restoreBackup(backup);
   return {rejected,merged:{url:merged.url,note:merged.note},restored:backup.items.map(x=>({space:x.space,url:x.url})),count:await db.collections.count(),bytes};
  });
  assert.equal(result.rejected,3);assert.deepEqual(result.merged,{url:'https://example.org/final',note:'并行更新的用途'});assert.equal(result.count,3);
  assert.equal(result.restored.find(x=>x.space==='website').url,'https://example.org/final');
  const zip=await JSZip.loadAsync(Buffer.from(result.bytes)),meta=JSON.parse(await zip.file('huixin.json').async('string'));assert.equal(meta.version,6,'website backup requires a new format version');
  const old={...meta,version:5,collections:meta.collections.filter(x=>x.space!=='website')};zip.file('huixin.json',JSON.stringify(old));
  const oldBytes=Array.from(await zip.generateAsync({type:'uint8array'}));
  const legacy=await page.evaluate(async bytes=>{const{readBackup}=await import('/src/data/backup.ts');return(await readBackup(new Blob([new Uint8Array(bytes)]))).items.map(x=>x.space)},oldBytes);
  assert.deepEqual(legacy.sort(),['game','music']);
  const invalid={...meta,collections:meta.collections.map(x=>x.space==='website'?{...x,url:'javascript:alert(1)'}:x)};zip.file('huixin.json',JSON.stringify(invalid));
  const badBytes=Array.from(await zip.generateAsync({type:'uint8array'}));
  const protectedData=await page.evaluate(async bytes=>{const{db}=await import('/src/data/db.ts');const{readBackup}=await import('/src/data/backup.ts');const before=await db.collections.count();let rejected=false;try{await readBackup(new Blob([new Uint8Array(bytes)]))}catch{rejected=true}return {before,after:await db.collections.count(),rejected}},badBytes);
  assert.deepEqual(protectedData,{before:3,after:3,rejected:true});

  await page.goto(url+'/#/music',{waitUntil:'networkidle'});assert.equal((await page.locator('h1').innerText()).replace(/\s/g,''),'会心馆私藏');
  await page.goto(url+'/#/website',{waitUntil:'networkidle'});await page.locator('.website-card').waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(process.env.HUIXIN_SHOT_DIR){fs.mkdirSync(process.env.HUIXIN_SHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.HUIXIN_SHOT_DIR,`website-room-${width}.png`),fullPage:true})}
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS websites: manual create/edit, persistent URL and purpose, safe links, search, concurrent edit merge, v6 round-trip, v5 legacy import, retained retired data, hidden retired routes, desktop/mobile layout');
 }finally{if(browser)await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
