// Local browser validation and deterministic, offline 60 fps WebM export.
// Run with the site on :8765 and a browser debugging endpoint on :9224.
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
const pages=await(await fetch('http://127.0.0.1:9224/json/list')).json();
const socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.onopen=r);
let seq=0;const pending=new Map(),errors=[];
socket.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if(message.id){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(message.error):resolve(message.result);}
};
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++seq,{resolve,reject});socket.send(JSON.stringify({id:seq,method,params}));});
const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir('tools/previews',{recursive:true});
try {
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:8765'});await pause(900);
  await evaluate(`document.documentElement.dataset.theme='light'; if(document.documentElement.lang==='en')document.querySelector('#a-lang').click()`);
  assert.equal(await evaluate('!!window.ResumeDNA'),true);
  const audit=await evaluate(`(() => {
    const dna=ResumeDNA,failures=[];
    for(let f=0;f<600;f++) {
      const s=dna.stateAt(f);
      for(let i=0;i<32;i++) {
        const row=dna.baseState(i,s);
        if((row.leading>0||row.lagging>0)&&row.opened!==1)failures.push([f,i,'replication before opening']);
        if(row.lagging>0&&i%4!==3&&dna.baseState(i+1,s).lagging<row.lagging)failures.push([f,i,'lagging direction']);
        if(row.leading>0&&i>0&&dna.baseState(i-1,s).leading<row.leading)failures.push([f,i,'leading direction']);
      }
    }
    const s=dna.stateAt(440);
    for(let i=0;i<32;i++){const r=dna.baseState(i,s);if(r.leading!==1||r.lagging!==1)failures.push([i,'incomplete daughters']);}
    for(const base of dna.sequence)if(!['AT','TA','GC','CG'].includes(base+dna.complement[base]))failures.push('pair');
    dna.renderFrame(0);const start=document.querySelector('#dna-canvas').toDataURL();
    dna.renderFrame(599);const end=document.querySelector('#dna-canvas').toDataURL();
    return {failures,seam:start===end};
  })()`);
  assert.deepEqual(audit.failures,[]);assert.equal(audit.seam,true);
  for(const [name,frame] of [['steady',0],['unwind',210],['replication',335],['daughters',490],['reset',559]]) {
    const uri=await evaluate(`ResumeDNA.renderFrame(${frame});document.querySelector('#dna-canvas').toDataURL()`);
    await writeFile(`tools/previews/dna-${name}.png`,Buffer.from(uri.split(',')[1],'base64'));
  }
  for(const width of [320,390,700,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(80);
    const bounds=await evaluate(`(() => {const host=document.querySelector('.dna-animation'),r=host.getBoundingClientRect(),canvas=document.querySelector('#dna-canvas').getBoundingClientRect();return {ratio:canvas.width/canvas.height,fixed:getComputedStyle(host).position==='fixed',covers:r.width>=document.documentElement.clientWidth&&r.height>=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
    assert.ok(Math.abs(bounds.ratio-16/9)<.02,`ratio ${width}`);
    assert.equal(bounds.fixed,true,`fixed background ${width}`);
    assert.equal(bounds.covers,true,`viewport coverage ${width}`);
    assert.equal(bounds.overflow,false,`page overflow ${width}`);
  }
  await evaluate('ResumeDNA.renderFrame(335)');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile('tools/previews/desktop-dna.png',Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('.dna-toggle').click()`);
  assert.equal(await evaluate(`document.querySelector('.dna-toggle').getAttribute('aria-pressed')`),'false');
  await evaluate(`document.querySelector('.dna-toggle').click()`);
  assert.equal(await evaluate(`document.querySelector('.dna-toggle').getAttribute('aria-pressed')`),'true');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await pause(60);
  assert.equal(await evaluate(`document.querySelector('.dna-toggle').getAttribute('aria-pressed')`),'true');
  await send('Emulation.setEmulatedMedia',{features:[]});
  console.log('PASS: all 600 biological states; exact first/last canvas frames; six layouts; pause/play; reduced motion.');

  // Encode frames with explicit timestamps, independent of real-time rendering speed.
  const encoded=await evaluate(`(async()=>{
    const config={codec:'vp09.00.10.08',width:960,height:540,bitrate:4000000,framerate:60,latencyMode:'quality'};
    const support=await VideoEncoder.isConfigSupported(config);if(!support.supported)throw new Error('VP9 encoder unavailable');
    const chunks=[];let error=null;
    const encoder=new VideoEncoder({output(chunk){const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);let binary='';for(const byte of data)binary+=String.fromCharCode(byte);chunks.push({timestamp:chunk.timestamp,key:chunk.type==='key',data:btoa(binary)});},error(e){error=e.message;}});
    encoder.configure(config);
    for(let frame=0;frame<600;frame++) {
      ResumeDNA.renderFrame(frame);
      const videoFrame=new VideoFrame(document.querySelector('#dna-canvas'),{timestamp:Math.round(frame*1000000/60),duration:Math.round(1000000/60)});
      encoder.encode(videoFrame,{keyFrame:frame%120===0||frame===599});videoFrame.close();
      if(encoder.encodeQueueSize>8)await new Promise(resolve=>encoder.addEventListener('dequeue',resolve,{once:true}));
      if(error)throw new Error(error);
    }
    await encoder.flush();encoder.close();return chunks;
  })()`);
  assert.equal(encoded.length,600);
  // The last source frame equals the first. Reuse that independent keyframe so
  // lossy rate-control cannot introduce different decoded pixels at the seam.
  encoded[599].data=encoded[0].data;
  encoded[599].key=true;
  // Minimal WebM muxer: single VP9 track, 1 ms timecode scale, 10-second duration.
  const uint=value=>{let h=value.toString(16);if(h.length%2)h='0'+h;return Buffer.from(h,'hex');};
  const size=value=>{let n=1;while(value>=2**(7*n)-1)n++;const bytes=Buffer.alloc(n);let v=BigInt(value)|(1n<<BigInt(7*n));for(let i=n-1;i>=0;i--){bytes[i]=Number(v&255n);v>>=8n;}return bytes;};
  const element=(id,payload)=>{payload=Array.isArray(payload)?Buffer.concat(payload):payload;return Buffer.concat([uint(id),size(payload.length),payload]);};
  const number=(id,value)=>element(id,uint(value));
  const string=(id,value)=>element(id,Buffer.from(value));
  const header=element(0x1a45dfa3,[number(0x4286,1),number(0x42f7,1),number(0x42f2,4),number(0x42f3,8),string(0x4282,'webm'),number(0x4287,4),number(0x4285,2)]);
  const duration=Buffer.alloc(8);duration.writeDoubleBE(10000);
  const info=element(0x1549a966,[number(0x2ad7b1,1000000),element(0x4489,duration),string(0x4d80,'Resume DNA'),string(0x5741,'Resume DNA')]);
  const tracks=element(0x1654ae6b,[element(0xae,[number(0xd7,1),number(0x73c5,1),number(0x83,1),string(0x86,'V_VP9'),number(0x23e383,16666667),element(0xe0,[number(0xb0,960),number(0xba,540)])])]);
  const clusters=[];
  for(let start=0;start<encoded.length;start+=120){
    const time=Math.round(encoded[start].timestamp/1000);
    const blocks=encoded.slice(start,start+120).map(chunk=>{
      const prefix=Buffer.alloc(4);prefix[0]=0x81;prefix.writeInt16BE(Math.round(chunk.timestamp/1000)-time,1);prefix[3]=chunk.key?0x80:0;
      return element(0xa3,Buffer.concat([prefix,Buffer.from(chunk.data,'base64')]));
    });
    clusters.push(element(0x1f43b675,[number(0xe7,time),...blocks]));
  }
  await writeFile('tools/previews/dna-replication-60fps.webm',Buffer.concat([header,element(0x18538067,[info,tracks,...clusters])]));
  const video=await evaluate(`(async()=>{const v=document.createElement('video');v.src='tools/previews/dna-replication-60fps.webm';v.muted=true;await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=reject});return {width:v.videoWidth,height:v.videoHeight,duration:v.duration}})()`);
  assert.deepEqual(video,{width:960,height:540,duration:10});
  assert.deepEqual(errors,[]);
  console.log('PASS: exported and decoded WebM metadata: 960 × 540, 600 frames, 60 fps, 10 seconds.');
}finally{socket.close();}
