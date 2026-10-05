/* Deterministic 600-frame / 10-second DNA replication illustration.
 * Right-handed B-DNA: 10.5 base pairs per turn, antiparallel templates.
 * This is a mechanism diagram, not an atomistic or enzyme simulation.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('dna-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) return;
  const host = canvas.closest('.dna-animation');
  const toggle = document.querySelector('.dna-toggle');
  const W = 960, H = 540, FPS = 60, FRAMES = 600, COUNT = 32, FRAGMENT = 4;
  const TAU = 2 * Math.PI;
  const sequence = 'ATGCGTACGATCGCATATGCCGATGCTAACGT';
  const complement = {A: 'T', T: 'A', G: 'C', C: 'G'};
  const color = {old: '#659dcf', fresh: '#c2f5ff', at: '#8ee6e8', gc: '#d8bc7c', text: '#9cb4c5'};
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  const blend = (a, b, t) => ({x: mix(a.x,b.x,t), y: mix(a.y,b.y,t), z: mix(a.z,b.z,t)});
  const baseColor = base => base === 'A' || base === 'T' ? color.at : color.gc;

  function stateAt(frame) {
    // Include an exact duplicate endpoint: frames 0 and 599 have identical pixels.
    const index = ((Math.floor(frame) % FRAMES) + FRAMES) % FRAMES;
    const t = index === FRAMES - 1 ? 0 : index / (FRAMES - 1);
    const stage = t < .2 ? 0 : t < .38 ? 1 : t < .72 ? 2 : t < .86 ? 3 : 4;
    // A single fork travels downward. Opening continues while synthesis catches up.
    const fork = t < .2 ? 0 : t < .38 ? .36 * ease((t-.2)/.18) :
      t < .64 ? mix(.36, 1.12, ease((t-.38)/.26)) : 1.12;
    const synthesis = ease((t-.38)/.32);
    const separation = ease((t-.72)/.14);
    const reset = ease((t-.86)/.14);
    // Integrated periodic speed: slow -> fast -> slow, with matching endpoint velocity.
    const rotation = TAU * (t - .62 * Math.sin(TAU*t)/TAU);
    const camera = .13 * Math.sin(TAU*t);
    const zoom = 1 + .035 * (1-Math.cos(TAU*t));
    return {index,t,stage,fork,synthesis,separation,reset,rotation,camera,zoom};
  }

  function baseState(i, s) {
    const row = (i+.5)/COUNT;
    const opened = ease((s.fork-row)/.09);
    // No new nucleotides can attach until that template position is fully open.
    const leading = opened < 1 ? 0 : ease((s.synthesis*COUNT-i)/.8);
    const fragment = Math.floor(i/FRAGMENT);
    const end = Math.min(COUNT-1, (fragment+1)*FRAGMENT-1);
    // Each fragment nucleates at its bottom (5′ end) and grows upward (3′ end).
    const fragmentReady = ease((s.fork-(end+.5)/COUNT)/.09) === 1;
    const localProgress = s.synthesis * (COUNT/FRAGMENT) - fragment;
    const lagging = !fragmentReady ? 0 : ease((localProgress*FRAGMENT-(end-i))/.8);
    return {row,opened,leading,lagging,fragment};
  }

  function geometry(i, side, s, opening, daughter = false) {
    const phase = TAU*i/10.5 + s.rotation + side*Math.PI;
    // World Y points upward; increasing sequence index moves the fork downward.
    // x=cos(theta), z=sin(theta), y=-rise*theta defines a right-handed helix.
    const y = 167 - i*(334/(COUNT-1));
    const initial = {x:32*Math.cos(phase), y, z:32*Math.sin(phase)};
    const direction = side === 0 ? -1 : 1;
    const axis = direction * (105 + 46*s.separation);
    // Opposite torsional relaxation around the advancing fork.
    const unwind = direction*.52 * Math.sin(Math.PI*clamp((s.t-.2)/.52));
    const childPhase = phase + unwind + (daughter ? Math.PI : 0);
    const split = {x:axis+32*Math.cos(childPhase), y, z:32*Math.sin(childPhase)};
    return blend(initial,split,opening);
  }

  function drawFrame(frame) {
    const s = stateAt(frame);
    const chinese = document.documentElement.lang !== 'en';
    const primitives = [];
    const labels = [];
    const project = p => {
      const x = p.x*Math.cos(s.camera)+p.z*Math.sin(s.camera);
      const z = -p.x*Math.sin(s.camera)+p.z*Math.cos(s.camera);
      const scale = (780/(780-z))*1.12*s.zoom;
      return {x:W/2+x*scale, y:H/2-p.y*scale, z, depth:clamp((z+70)/140)};
    };
    const line = (a,b,ink,alpha=1,glow=false) => {
      if (alpha <= .001) return;
      const pa=project(a),pb=project(b);
      primitives.push({kind:'line',a:pa,b:pb,z:(pa.z+pb.z)/2,ink,alpha,glow});
    };
    const dot = (p,ink,alpha=1,radius=2.8) => {
      if (alpha <= .001) return;
      const pp=project(p);
      primitives.push({kind:'dot',p:pp,z:pp.z,ink,alpha,radius});
    };
    const label = (p,text,ink=color.text,alpha=1,dx=0,dy=0) => {
      if(alpha>.05) labels.push({p:project(p),text,ink,alpha,dx,dy});
    };
    const pair = (a,b,base,alpha=1) => {
      // Two or three short central bars indicate hydrogen bonds, not backbone strands.
      const left=blend(a,b,.44),right=blend(a,b,.56),ink=baseColor(base);
      line(a,left,ink,alpha*.75);line(right,b,ink,alpha*.75);
      const bonds=base==='A'||base==='T'?2:3;
      for(let k=0;k<bonds;k++) {
        const offset=(k-(bonds-1)/2)*2.6;
        line({...left,y:left.y+offset},{...right,y:right.y+offset},ink,alpha);
      }
      dot(blend(a,b,.24),ink,alpha,2.2);dot(blend(a,b,.76),ink,alpha,2.2);
    };
    const visibility = 1-s.reset;
    const strands = [[],[]], fresh = [[],[]], rows = [];
    for(let i=0;i<COUNT;i++) {
      const row=baseState(i,s);rows.push(row);
      for(let side=0;side<2;side++) {
        strands[side].push(geometry(i,side,s,row.opened));
        fresh[side].push(geometry(i,side,s,1,true));
      }
    }
    for(let i=0;i<COUNT;i++) {
      const row=rows[i],oldA=strands[0][i],oldB=strands[1][i];
      // Opening breaks existing bonds; nucleotide halves stay tethered to their templates.
      pair(oldA,oldB,sequence[i],(1-row.opened)*visibility);
      for(let side=0;side<2;side++) {
        const parent=strands[side][i],next=fresh[side][i];
        const added=side===0?row.leading:row.lagging;
        const templateBase=side===0?sequence[i]:complement[sequence[i]];
        const newBase=complement[templateBase];
        if(i>0) line(strands[side][i-1],parent,color.old,visibility,true);
        dot(parent,color.old,visibility,3);
        if(row.opened>0) {
          const stub=blend(parent,next,.23);
          line(parent,stub,baseColor(templateBase),row.opened*(1-added)*visibility);
          dot(stub,baseColor(templateBase),row.opened*(1-added)*visibility,2.3);
        }
        if(added>0) {
          // Free complementary particles settle onto exposed template positions only.
          const approach={x:next.x+(side===0?-22:22)*(1-added),y:next.y+7*(1-added),z:next.z+10*(1-added)};
          dot(approach,color.fresh,added*visibility,3.3);
          pair(parent,approach,newBase,added*visibility);
          if(i>0) {
            const previous=side===0?rows[i-1].leading:rows[i-1].lagging;
            const boundary=side===1&&i%FRAGMENT===0;
            // Join neighboring Okazaki fragments only after synthesis is complete.
            const ligation=boundary?ease((s.t-.70)/.02):1;
            line(fresh[side][i-1],next,color.fresh,Math.min(added,previous)*visibility*ligation,true);
          }
        }
      }
    }
    // During reset cross-dissolve into the intact starting helix; do not depict reverse synthesis.
    if(s.reset>0) {
      const initial={...s,fork:0,separation:0};
      for(let i=0;i<COUNT;i++) {
        const a=geometry(i,0,initial,0),b=geometry(i,1,initial,0);
        pair(a,b,sequence[i],s.reset);
        for(let side=0;side<2;side++) {
          const p=geometry(i,side,initial,0);
          dot(p,color.old,s.reset,3);
          if(i>0)line(geometry(i-1,side,initial,0),p,color.old,s.reset,true);
        }
      }
      for(let side=0;side<2;side++) {
        label(geometry(0,side,initial,0),side===0?'3′':'5′',color.old,s.reset,side===0?-14:14,-16);
        label(geometry(COUNT-1,side,initial,0),side===0?'5′':'3′',color.old,s.reset,side===0?-14:14,22);
      }
    }
    for(let side=0;side<2;side++) {
      label(strands[side][0],side===0?'3′':'5′',color.old,visibility,side===0?-14:14,-16);
      label(strands[side][COUNT-1],side===0?'5′':'3′',color.old,visibility,side===0?-14:14,22);
      const completed=side===0?rows[COUNT-1].leading:rows[0].lagging;
      label(fresh[side][0],side===0?'5′':'3′',color.fresh,completed*visibility,side===0?15:-15,-16);
      label(fresh[side][COUNT-1],side===0?'3′':'5′',color.fresh,rows[COUNT-1][side===0?'leading':'lagging']*visibility,side===0?15:-15,22);
    }
    if(s.stage===2) {
      const growth=Math.min(COUNT-1,Math.floor(s.synthesis*COUNT));
      const frag=Math.min(COUNT/FRAGMENT-1,Math.floor(s.synthesis*COUNT/FRAGMENT));
      const end=Math.min(COUNT-1,(frag+1)*FRAGMENT-1);
      const lagIndex=Math.max(frag*FRAGMENT,end-Math.floor((s.synthesis*COUNT/FRAGMENT-frag)*FRAGMENT));
      // Indicators point down for leading, up for lagging: both are chemically 5′→3′.
      if(rows[growth].opened===1) label(fresh[0][growth],'↓ 5′→3′',color.fresh,1,-74,4);
      if(rows[end].opened===1) label(fresh[1][lagIndex],'↑ 5′→3′',color.fresh,1,74,4);
    }

    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    primitives.sort((a,b)=>a.z-b.z);
    ctx.lineWidth=1.15;ctx.lineCap='round';ctx.lineJoin='round';
    for(const p of primitives) {
      // Depth is expressed through opacity and soft glow, never variable line width or ellipses.
      const depth=p.kind==='dot'?p.p.depth:(p.a.depth+p.b.depth)/2;
      ctx.globalAlpha=p.alpha*(.5+.5*depth);
      ctx.shadowColor=p.ink;ctx.shadowBlur=p.kind==='dot'?6:(p.glow?3:0);
      if(p.kind==='line') {
        ctx.strokeStyle=p.ink;ctx.beginPath();ctx.moveTo(p.a.x,p.a.y);ctx.lineTo(p.b.x,p.b.y);ctx.stroke();
      } else {
        ctx.fillStyle=p.ink;ctx.beginPath();ctx.arc(p.p.x,p.p.y,p.radius,0,TAU);ctx.fill();
      }
    }
    ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='18px ui-monospace, monospace';
    for(const l of labels) {ctx.globalAlpha=l.alpha;ctx.fillStyle=l.ink;ctx.fillText(l.text,l.p.x+l.dx,l.p.y+l.dy);}
    ctx.globalAlpha=1;ctx.textAlign='left';ctx.fillStyle='#a3c4d9';ctx.font='20px ui-monospace, monospace';
    ctx.fillText('DNA / REPLICATION',28,38);
    ctx.font='17px ui-monospace, monospace';
    ctx.fillStyle=color.at;ctx.fillText('A–T · 2',28,76);
    ctx.fillStyle=color.gc;ctx.fillText('G–C · 3',28,102);
    ctx.fillStyle=color.old;ctx.fillText(chinese?'母链':'TEMPLATE',28,140);
    ctx.fillStyle=color.fresh;ctx.fillText(chinese?'新链':'NEW STRAND',28,166);
    if(s.stage===2||s.stage===3) {
      ctx.fillStyle=color.text;ctx.textAlign='center';ctx.font='18px sans-serif';
      ctx.fillText(chinese?'连续延伸':'LEADING',260,460);
      ctx.fillText(chinese?'冈崎片段':'OKAZAKI',700,460);
    }
    const names=chinese?['稳态 · B 型双螺旋','解旋 · 复制叉打开','复制 · 5′→3′ 合成','子代分离 · 半保留复制','视觉复位 · 循环转场']:
      ['B-DNA / STEADY','UNWIND / REPLICATION FORK','SYNTHESIS / 5′→3′','DAUGHTERS / SEMICONSERVATIVE','VISUAL RESET / LOOP'];
    ctx.textAlign='left';ctx.fillStyle='#b5cbd9';ctx.font='21px sans-serif';
    ctx.fillText(`${String(s.stage+1).padStart(2,'0')}  ${names[s.stage]}`,28,510);
    for(let i=0;i<5;i++) {ctx.fillStyle=i===s.stage?'#8ee6e8':'#26353f';ctx.fillRect(762+i*30,501,20,3);}
    canvas.dataset.stage=String(s.stage);
    return s;
  }

  let raf=0, lastTick=null, elapsed=0, lastFrame=-1, onScreen=true;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=motion.matches;
  function updateControl() {
    const chinese=document.documentElement.lang!=='en';
    toggle.textContent=paused?'▷':'Ⅱ';
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.setAttribute('aria-label',chinese?(paused?'播放 DNA 动画':'暂停 DNA 动画'):(paused?'Play DNA animation':'Pause DNA animation'));
  }
  function tick(now) {
    raf=0;
    if(paused||document.hidden||!onScreen){lastTick=null;return;}
    if(lastTick!==null)elapsed+=Math.min(now-lastTick,100);
    lastTick=now;
    const frame=Math.floor(elapsed/(1000/FPS))%FRAMES;
    if(frame!==lastFrame){drawFrame(frame);lastFrame=frame;}
    raf=requestAnimationFrame(tick);
  }
  function start(){if(!raf&&!paused&&!document.hidden&&onScreen)raf=requestAnimationFrame(tick);}
  function stop(){cancelAnimationFrame(raf);raf=0;lastTick=null;}
  toggle.addEventListener('click',()=>{paused=!paused;updateControl();if(paused)stop();else start();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    onScreen=entries[0].isIntersecting;if(onScreen)start();else stop();
  }).observe(host);
  motion.addEventListener('change',()=>{paused=motion.matches;updateControl();if(paused){stop();drawFrame(0);}else start();});
  new MutationObserver(()=>{updateControl();drawFrame(Math.max(0,lastFrame));}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('beforeprint',()=>{stop();drawFrame(0);});
  window.addEventListener('afterprint',start);
  // Deterministic frame access also supports still previews and frame-by-frame export.
  window.ResumeDNA=Object.freeze({frames:FRAMES,fps:FPS,duration:10,stateAt,baseState,
    sequence,complement,renderFrame(frame){paused=true;stop();updateControl();lastFrame=frame;return drawFrame(frame);}});
  updateControl();drawFrame(0);start();
})();
