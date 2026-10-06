(() => {
  'use strict';
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  const W = 1280, H = 680, GROUND = 528, anchor = {x:230,y:413};
  const $ = s => document.querySelector(s);
  const engine = Engine.create({enableSleeping:true});
  engine.gravity.y = 1; engine.positionIterations = 8;
  let level = 0, score = 0, shots = 3, activeBird = null, objects = [], particles = [], floating = [], trail = [];
  let phase = 'ready', paused = false, dragging = false, pointerId = null, aim = {...anchor};
  let elapsed = 0, shotTime = 0, stillTime = 0, settleTime = 0, pendingDamage = new Map(), outcomeShown = false;
  const scenery = new Image(); scenery.src = 'landscape.png';
  const palette = ['#f35a48','#f09e36','#e65851'];
  function updateHUD() {
    $('#score').textContent = score.toLocaleString('zh-CN'); $('#level-label').textContent = `0${level+1} / 03`;
    $('#targets').textContent = objects.filter(b=>b.gameType==='pig').length;
    $('#birds').innerHTML = Array.from({length:3},(_,i)=>`<span class="bird-dot ${i>=shots?'used':''}"></span>`).join('');
    $('#birds').setAttribute('aria-label', `剩余 ${shots} 只小鸟`);
    document.querySelectorAll('[data-level]').forEach(b=>{const selected=+b.dataset.level===level;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    $('#aim-tip').style.opacity = phase==='ready' && shots===3 ? '1':'0';
  }
  function wood(x,y,w,h) {
    const b=Bodies.rectangle(x,y,w,h,{density:.0017,friction:.55,restitution:.08,slop:.03});
    Object.assign(b,{gameType:'wood',hp:7,w,h}); objects.push(b); Composite.add(engine.world,b); return b;
  }
  function pig(x,y,r=21) {
    const b=Bodies.circle(x,y,r,{density:.002,friction:.6,restitution:.12,frictionAir:.012});
    Object.assign(b,{gameType:'pig',hp:3.4,r}); objects.push(b); Composite.add(engine.world,b); return b;
  }
  function tower(x,high=false) {
    wood(x-48,GROUND-49,22,98);wood(x+48,GROUND-49,22,98);wood(x,GROUND-106,132,18);
    pig(x,GROUND-138);
    if(high){wood(x-42,GROUND-154,19,78);wood(x+42,GROUND-154,19,78);wood(x,GROUND-203,118,17);pig(x,GROUND-232,20);}
  }
  function loadLevel(index=level) {
    level=Math.max(0,Math.min(2,index));Composite.clear(engine.world,false);Engine.clear(engine);
    score=0;shots=3;activeBird=null;objects=[];particles=[];floating=[];trail=[];pendingDamage.clear();
    elapsed=0;shotTime=0;stillTime=0;settleTime=0;phase='ready';paused=false;dragging=false;pointerId=null;aim={...anchor};outcomeShown=false;
    $('#overlay').hidden=true;$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','暂停游戏');
    clearTimeout(showToast.timer);$('#toast').textContent='';$('#toast').classList.remove('visible');
    const ground=Bodies.rectangle(W/2,GROUND+50,W+2000,100,{isStatic:true,friction:.8});ground.gameType='ground';Composite.add(engine.world,ground);
    if(level===0){tower(842);pig(1032,GROUND-22);wood(1032,GROUND-60,110,16);wood(990,GROUND-32,16,48);wood(1074,GROUND-32,16,48);}
    if(level===1){tower(805);tower(1048);pig(928,GROUND-21);}
    if(level===2){tower(840,true);tower(1067);}
    // Let the structures settle before impacts can score or destroy them.
    for(let i=0;i<90;i++)Engine.update(engine,1000/60);
    pendingDamage.clear(); updateHUD();
  }
  function showToast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),1900);}
  function setAim(x,y) {
    let dx=x-anchor.x,dy=y-anchor.y;const len=Math.hypot(dx,dy);if(len>100){dx*=100/len;dy*=100/len;}
    aim={x:anchor.x+dx,y:anchor.y+dy};
  }
  function launch() {
    if(phase!=='ready'||paused||shots<=0)return false;
    const dx=anchor.x-aim.x,dy=anchor.y-aim.y;
    if(Math.hypot(dx,dy)<8){aim={...anchor};dragging=false;return false;}
    activeBird=Bodies.circle(aim.x,aim.y,19,{density:.009,friction:.45,frictionAir:.003,restitution:.35});
    Object.assign(activeBird,{gameType:'bird',r:19});Composite.add(engine.world,activeBird);
    Body.setVelocity(activeBird,{x:dx*.18,y:dy*.18});shots--;phase='flying';dragging=false;shotTime=elapsed;stillTime=0;trail=[];updateHUD();return true;
  }
  function burst(x,y,color,n=16) {for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8-2,life:1,size:Math.random()*5+2,color});}
  function destroy(b) {
    if(!objects.includes(b))return;
    const points=b.gameType==='pig'?500:50; score+=points;burst(b.position.x,b.position.y,b.gameType==='pig'?'#9fce56':'#d7a264');
    floating.push({x:b.position.x,y:b.position.y,text:`+${points}`,life:1});Composite.remove(engine.world,b);objects=objects.filter(o=>o!==b);updateHUD();
  }
  Events.on(engine,'collisionStart',event=>{
    if(phase!=='flying')return;
    for(const pair of event.pairs){const a=pair.bodyA,b=pair.bodyB;const relative=Math.hypot(a.velocity.x-b.velocity.x,a.velocity.y-b.velocity.y);
      const impact=Math.max(relative,a.speed,b.speed);
      for(const [target,other] of [[a,b],[b,a]]){
        if(!['pig','wood'].includes(target.gameType))continue;
        const threshold=target.gameType==='pig'?1.8:3.5;
        if(impact>threshold){const damage=(impact-threshold)* (other.gameType==='bird'?1.7:1);pendingDamage.set(target,(pendingDamage.get(target)||0)+damage);}
      }
    }
  });
  function finish(won) {
    if(outcomeShown)return;outcomeShown=true;phase=won?'won':'lost';
    if(won){score+=shots*300;burst(680,220,'#ffc653',42);}updateHUD();
    $('#result-symbol').textContent=won?'★':'↻';$('#result-kicker').textContent=won?'关卡完成':'再试一次';
    $('#result-title').textContent=won?(level===2?'三关全通，太棒了！':'漂亮的一击！'):'还差一点点！';
    $('#result-detail').textContent=won?`得分 ${score.toLocaleString('zh-CN')} · 剩余小鸟奖励 ${shots*300}`:`还有 ${objects.filter(o=>o.gameType==='pig').length} 个目标，试试不同的角度。`;
    $('#result-action').textContent=won&&level<2?'下一关':won?'从第一关再玩':'重新挑战';
    $('#result-retry').hidden=!won;$('#overlay').hidden=false;$('#result-action').focus({preventScroll:true});
  }
  function step(dt=1000/60) {
    if(paused)return;elapsed+=dt;
    if(phase==='flying'){
      Engine.update(engine,dt);
      for(const [b,damage]of pendingDamage){b.hp-=damage;if(b.hp<=0)destroy(b);}pendingDamage.clear();
      for(const b of [...objects]){if(b.position.y>H+80||b.position.x>W+160||b.position.x<-160)destroy(b);}
      if(activeBird&&elapsed-shotTime<4000){trail.push({...activeBird.position});if(trail.length>32)trail.shift();}
      const pigs=objects.filter(b=>b.gameType==='pig');
      if(pigs.length===0){settleTime+=dt;if(settleTime>500)finish(true);}
      else {
        const birdDone=!activeBird||activeBird.speed<.5||activeBird.position.x>W+120||activeBird.position.y>H+100||activeBird.position.x<-120;
        stillTime=birdDone?stillTime+dt:0;
        const structuresMoving=objects.some(b=>b.speed>.7);
        if((stillTime>900&&!structuresMoving)||elapsed-shotTime>8500){
          if(shots>0){phase='ready';aim={...anchor};if(activeBird)Composite.remove(engine.world,activeBird);activeBird=null;trail=[];updateHUD();showToast('下一只小鸟准备好了');}
          else if(!structuresMoving||elapsed-shotTime>11000)finish(false);
        }
      }
    }
    particles.forEach(p=>{p.x+=p.vx*dt/16.67;p.y+=p.vy*dt/16.67;p.vy+=.12*dt/16.67;p.life-=dt/900;});particles=particles.filter(p=>p.life>0);
    floating.forEach(p=>{p.y-=dt*.035;p.life-=dt/1000;});floating=floating.filter(p=>p.life>0);
  }
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function drawBird(x,y,r,angle=0) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ellipse(-3,4,r*.9,r*.9,'#ca4036');ellipse(0,-1,r,r,'#f25947');ellipse(-2,7,r*.65,r*.48,'#ffd8b2');
    ctx.fillStyle='#f25947';ctx.beginPath();ctx.moveTo(-5,-r+3);ctx.lineTo(-11,-r-9);ctx.lineTo(1,-r+1);ctx.lineTo(0,-r-11);ctx.lineTo(8,-r+5);ctx.fill();
    ellipse(7,-5,6,7,'#fffdf4');ellipse(9,-4,2.5,3,'#293c3a');
    ctx.strokeStyle='#66372f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(1,-13);ctx.lineTo(13,-10);ctx.stroke();
    ctx.fillStyle='#ffbf3e';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(r+10,5);ctx.lineTo(12,10);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawPig(b) {
    const {x,y}=b.position,r=b.r;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
    ellipse(-r*.55,-r*.8,7,9,'#83b94b');ellipse(r*.55,-r*.8,7,9,'#83b94b');ellipse(0,0,r,r,'#80b749');ellipse(-2,-3,r*.87,r*.85,'#a3ce5e');
    ellipse(-7,-6,5,6,'#fffdf3');ellipse(7,-6,5,6,'#fffdf3');ellipse(-6,-5,2,3,'#33483a');ellipse(6,-5,2,3,'#33483a');ellipse(0,5,11,8,'#c6e689');
    ellipse(-4,5,2,3,'#638c3d');ellipse(4,5,2,3,'#638c3d');ctx.strokeStyle='#719b3f';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,8,12,.45,Math.PI-.45);ctx.stroke();ctx.restore();
  }
  function drawWood(b) {
    ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);ctx.fillStyle='#bc813f';ctx.strokeStyle='#8e5b32';ctx.lineWidth=2.5;ctx.beginPath();ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,3);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#e3b66d';ctx.lineWidth=2;ctx.beginPath();if(b.w>b.h){ctx.moveTo(-b.w/2+7,-b.h/2+4);ctx.lineTo(b.w/2-7,-b.h/2+4);}else{ctx.moveTo(-b.w/2+4,-b.h/2+7);ctx.lineTo(-b.w/2+4,b.h/2-7);}ctx.stroke();
    ctx.strokeStyle='#9b682e';ctx.lineWidth=1;ctx.beginPath();if(b.w>b.h){ctx.moveTo(-b.w/2+9,2);ctx.bezierCurveTo(-15,-4,12,6,b.w/2-9,1);}else{ctx.moveTo(2,-b.h/2+9);ctx.bezierCurveTo(-4,-15,6,12,1,b.h/2-9);}ctx.stroke();
    if(b.hp<4){ctx.strokeStyle='#704628';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-6,-7);ctx.lineTo(4,-2);ctx.lineTo(-2,3);ctx.lineTo(7,9);ctx.stroke();}ctx.restore();
  }
  function sling(front=false) {
    ctx.lineCap='round';ctx.strokeStyle=front?'#986b39':'#754b29';ctx.lineWidth=front?13:15;ctx.beginPath();
    if(front){ctx.moveTo(220,514);ctx.lineTo(219,448);ctx.lineTo(207,404);}else{ctx.moveTo(220,514);ctx.lineTo(219,448);ctx.lineTo(247,402);}ctx.stroke();
    ctx.strokeStyle='#c69d5f';ctx.lineWidth=4;ctx.beginPath();if(front){ctx.moveTo(216,503);ctx.lineTo(215,447);ctx.lineTo(205,409);}else{ctx.moveTo(243,408);ctx.lineTo(225,445);}ctx.stroke();
  }
  function render() {
    ctx.clearRect(0,0,W,H);
    if(scenery.complete&&scenery.naturalWidth){ctx.drawImage(scenery,0,0,W,H);}else{const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#a9dce9');g.addColorStop(.77,'#daf0db');g.addColorStop(1,'#527047');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
    // A precise collision surface keeps the illustrated ground aligned with gameplay.
    ctx.fillStyle='#688a48';ctx.fillRect(0,GROUND,W,H-GROUND);ctx.fillStyle='#a0bf59';ctx.fillRect(0,GROUND,W,9);ctx.fillStyle='#819e4c';ctx.fillRect(0,GROUND+9,W,8);
    ctx.fillStyle='#35513522';for(let i=0;i<25;i++){ctx.fillRect((i*127+31)%W,GROUND+34+(i*41)%100,4,3);}
    ellipse(220,GROUND+3,39,7,'#29452925');objects.forEach(b=>ellipse(b.position.x,GROUND+4,Math.min(b.w||b.r,40),4,'#29452916'));
    sling();
    const birdPoint=phase==='ready'?aim:anchor;
    if(phase==='ready'){ctx.strokeStyle='#5b3827';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(247,406);ctx.lineTo(birdPoint.x,birdPoint.y+3);ctx.stroke();}
    if(phase==='ready'&&Math.hypot(aim.x-anchor.x,aim.y-anchor.y)>8){
      let px=aim.x,py=aim.y,vx=(anchor.x-aim.x)*.18,vy=(anchor.y-aim.y)*.18;
      for(let i=0;i<70;i++){vx*=.997;vy=vy*.997+.278;px+=vx;py+=vy;if(py>GROUND)break;if(i%4===0)ellipse(px,py,Math.max(2,4-i*.04),Math.max(2,4-i*.04),'#ffffffcf');}
    }
    trail.forEach((p,i)=>ellipse(p.x,p.y,2.2,2.2,`rgba(255,255,255,${i/trail.length*.7})`));
    objects.filter(b=>b.gameType==='wood').forEach(drawWood);objects.filter(b=>b.gameType==='pig').forEach(drawPig);
    if(activeBird)drawBird(activeBird.position.x,activeBird.position.y,19,activeBird.angle);
    if(phase==='ready')drawBird(aim.x,aim.y,19);
    if(phase==='ready'){ctx.strokeStyle='#75482d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(207,408);ctx.lineTo(birdPoint.x-4,birdPoint.y+6);ctx.stroke();}
    sling(true);for(let i=0;i<Math.max(0,shots-(phase==='ready'?1:0));i++)drawBird(152-i*41,GROUND-15,14);
    particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});ctx.globalAlpha=1;
    ctx.font='bold 23px "Segoe UI",sans-serif';ctx.textAlign='center';floating.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle='#3d683d';ctx.fillText(p.text,p.x,p.y);});ctx.globalAlpha=1;
  }
  function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  canvas.addEventListener('pointerdown',e=>{if(phase!=='ready'||paused)return;const p=point(e);const hitRadius=Math.max(50,32*W/canvas.getBoundingClientRect().width);if(Math.hypot(p.x-aim.x,p.y-aim.y)>hitRadius)return;dragging=true;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});setAim(p.x,p.y);e.preventDefault();});
  canvas.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pointerId)return;const p=point(e);setAim(p.x,p.y);});
  canvas.addEventListener('pointerup',e=>{if(!dragging||e.pointerId!==pointerId)return;const p=point(e);setAim(p.x,p.y);dragging=false;pointerId=null;launch();});
  function cancelAim(){dragging=false;pointerId=null;aim={...anchor};}
  canvas.addEventListener('pointercancel',cancelAim);canvas.addEventListener('lostpointercapture',()=>{if(dragging)cancelAim();});
  window.addEventListener('keydown',e=>{
    if($('#help-dialog').open||['BUTTON','A','INPUT'].includes(document.activeElement?.tagName))return;
    if(e.key.toLowerCase()==='r'){loadLevel();return;}
    if(e.key==='Escape'){cancelAim();return;}
    if(phase!=='ready'||paused)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(e.key))e.preventDefault();
    if(e.key===' '||e.key==='Enter'){if(Math.hypot(aim.x-anchor.x,aim.y-anchor.y)<8)setAim(anchor.x-70,anchor.y+60);launch();}
    else if(e.key.startsWith('Arrow')){setAim(aim.x+(e.key==='ArrowLeft'?-6:e.key==='ArrowRight'?6:0),aim.y+(e.key==='ArrowUp'?-6:e.key==='ArrowDown'?6:0));}
  });
  $('#restart').onclick=()=>{loadLevel();canvas.focus({preventScroll:true});};
  document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{loadLevel(+b.dataset.level);canvas.focus({preventScroll:true});});
  $('#pause').onclick=()=>{
    if(['won','lost'].includes(phase))return;paused=!paused;cancelAim();$('#pause').textContent=paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');
    if(paused){$('#result-symbol').textContent='Ⅱ';$('#result-kicker').textContent='休息一下';$('#result-title').textContent='游戏已暂停';$('#result-detail').textContent='准备好了，就继续出发。';$('#result-action').textContent='继续游戏';$('#result-retry').hidden=true;$('#overlay').hidden=false;}else{$('#overlay').hidden=true;canvas.focus({preventScroll:true});}
  };
  $('#result-action').onclick=()=>{if(paused){$('#pause').click();return;}const next=phase==='won'?(level+1)%3:level;loadLevel(next);canvas.focus({preventScroll:true});};
  $('#result-retry').onclick=()=>{loadLevel();canvas.focus({preventScroll:true});};
  $('#help').onclick=()=>{if(!paused&&!['won','lost'].includes(phase)){$('#pause').click();$('#help-dialog').dataset.autoResume='yes';}$('#help-dialog').showModal();};
  function closeHelp(){$('#help-dialog').close();if($('#help-dialog').dataset.autoResume==='yes'){delete $('#help-dialog').dataset.autoResume;if(paused)$('#pause').click();}}
  $('#close-help').onclick=closeHelp;$('#got-it').onclick=closeHelp;$('#help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});
  function state(){return {level:level+1,score,shots,targets:objects.filter(b=>b.gameType==='pig').length,phase,paused};}
  function fireInput(input){if(!input||!Number.isFinite(input.pullX)||!Number.isFinite(input.pullY)||Math.hypot(input.pullX,input.pullY)<8||Math.hypot(input.pullX,input.pullY)>100)throw new Error('拉伸距离须在 8 到 100 之间。');if(phase!=='ready'||paused)throw new Error('当前不能发射。');setAim(anchor.x+input.pullX,anchor.y+input.pullY);launch();return state();}
  if(document.modelContext?.registerTool){for(const tool of [
    {name:'read_bird_game',description:'读取当前关卡、得分、剩余小鸟和目标。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:state},
    {name:'launch_bird',description:'在准备状态拉动弹弓并发射小鸟。负 pullX 向后拉，正 pullY 向下拉。',inputSchema:{type:'object',properties:{pullX:{type:'number',minimum:-100,maximum:100},pullY:{type:'number',minimum:-100,maximum:100}},required:['pullX','pullY'],additionalProperties:false},annotations:{readOnlyHint:false},execute:fireInput},
    {name:'restart_bird_level',description:'重新开始指定关卡，清空当前得分。',inputSchema:{type:'object',properties:{level:{type:'integer',minimum:1,maximum:3}},required:['level'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!Number.isInteger(input?.level)||input.level<1||input.level>3)throw Error('关卡须为 1 到 3。');loadLevel(input.level-1);return state();}}
  ]){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}}
  // Shared actions also support deterministic local physics verification.
  window.birdGame={state,fire:fireInput,restart:loadLevel,step};
  loadLevel();let last=0,accumulator=0;
  function frame(now){if(!last)last=now;accumulator+=Math.min(now-last,80);last=now;while(accumulator>=1000/60){step();accumulator-=1000/60;}render();requestAnimationFrame(frame);}
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});requestAnimationFrame(frame);
})();
