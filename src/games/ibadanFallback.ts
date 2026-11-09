import type { CityOptions } from "./ibadanScene";
import { cityFlightAt, type CityFlightMode } from "./cityFlight";

/** Low-power animated city with the same home/departure lifecycle. */
export function createIbadanFallback({ canvas, billboards, clouds, data, flight, paused, onProgress, onComplete, onReady }: CityOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The city renderer is unavailable on this device.");
  const g = ctx, sorted = data.buildings.slice(0, 450);
  const crossingProgress = Array.from({ length: 8 }, (_, i) => (i * .17) % 1);
  const crossingStun = new Float32Array(8);
  let elapsed = 0, last = performance.now(), raf = 0, stopped = false, done = false, lastTick = -1;
  let active: CityFlightMode = flight();
  canvas.dataset.renderMode = "canvas";
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    const p = canvas.parentElement;
    const width = Math.max(1, p?.clientWidth ?? 1), height = Math.max(1, p?.clientHeight ?? 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (canvas.parentElement) observer?.observe(canvas.parentElement);
  window.addEventListener("resize", resize); resize();
  function frame(now: number) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.25, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const command = flight();
    if (command !== active) { active = command; elapsed = 0; done = false; lastTick = -1; }
    if (active !== "home" && !paused()) elapsed += dt;
    const pose = cityFlightAt(active, elapsed);
    const tick = Math.floor(elapsed * 5);
    if (tick !== lastTick) { lastTick = tick; onProgress(pose); }
    canvas.dataset.flightMode = active; canvas.dataset.flightSeconds = String(pose.remaining);
    canvas.dataset.helicopterY = String(1.35 + pose.lift * 10 + pose.travel * 11);
    if (clouds) { clouds.style.opacity = String(pose.cloud); clouds.dataset.cloud = pose.cloud > .98 ? "covered" : pose.cloud > .02 ? "transition" : "clear"; }
    const w = canvas.width / ratio, h = canvas.height / ratio, shift = pose.travel * w * .22;
    g.fillStyle = "#9ac9df"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8ba77b"; g.fillRect(0, h * .37, w, h * .63);
    for (const [x,z,bw,bd,bh,k] of sorted) {
      const px = w * .49 + x * w * .006 - shift, py = h * .62 + z * h * .004;
      const hh = Math.max(2, bh * h * .028), ww = Math.max(2, bw * w * .005);
      g.fillStyle = ["#d1c2a8","#bfab92","#e0d1b9"][k % 3]; g.fillRect(px, py-hh, ww, hh);
      g.fillStyle = ["#a45c43","#8f5744","#bd7955"][k % 3]; g.fillRect(px, py-hh, ww, Math.max(2, bd*h*.002));
    }
    g.fillStyle = "#666f6b"; g.beginPath(); g.moveTo(0,h*.73);g.lineTo(w,h*.43);g.lineTo(w,h*.53);g.lineTo(0,h*.84);g.closePath();g.fill();
    g.strokeStyle = "#d9ddc6";g.lineWidth=2;g.setLineDash([12,12]);g.beginPath();g.moveTo(0,h*.785);g.lineTo(w,h*.48);g.stroke();g.setLineDash([]);
    for (let slot=0; slot<billboards.length; slot++) {
      const bw=w*.13,bh=h*.13;
      const bx=w*(.035+slot*(.93-bw/w)/Math.max(1,billboards.length-1)),by=h*(.16+(slot%2)*.025);
      g.fillStyle="#253731";g.fillRect(bx-3,by-3,bw+6,bh+6);g.fillRect(bx+bw*.12,by+bh,4,h*.12);g.fillRect(bx+bw*.85,by+bh,4,h*.12);
      const board=billboards[slot];
      if(board){board.style.visibility=pose.cloud>.65?"hidden":"visible";board.style.width=`${Math.round(bw)}px`;board.style.height=`${Math.round(bh)}px`;board.style.transform=pose.cloud>.65?"translate3d(-10000px,-10000px,0)":`translate3d(${Math.round(bx)}px,${Math.round(by)}px,0)`;}
    }
    g.fillStyle="#43839c";g.fillRect(w*.38-shift*.3,h*.49,w*.18,h*.025);g.fillRect(w*.38-shift*.3,h*.58,w*.18,h*.02);
    const trafficX:number[]=[],trafficY:number[]=[];
    for(let k=0;k<16;k++){const x=(k*87+now*.03)%w,y=h*.79-x*.3;trafficX[k]=x;trafficY[k]=y;g.fillStyle=k%3?"#e0b339":"#d2d7c9";g.fillRect(x,y,12,6);}
    for(let k=0;k<30;k++){const x=(k*37+now*(k%3?.01:.02))%(w*.55),y=h*.8-x*.27+22+(k%4)*5;g.fillStyle=["#d8ae68","#bf7354","#e5d9c2"][k%3];g.fillRect(x,y,3,6);g.fillStyle="#8c5d3c";g.beginPath();g.arc(x+1.5,y-1,2,0,Math.PI*2);g.fill();}
    for(let i=0;i<8;i++){
      const x=w*(.22+i*.07),roadY=h*.79-x*.3;
      if(crossingStun[i]>0)crossingStun[i]=Math.max(0,crossingStun[i]-dt);
      else crossingProgress[i]=(crossingProgress[i]+dt*.14)%1;
      let progress=crossingProgress[i],stun=crossingStun[i];
      let y=roadY+(progress-.5)*h*.075;
      if(stun===0){
        const collision=trafficX.some((car,carIndex)=>Math.abs(car-x)<11&&Math.abs(trafficY[carIndex]-y)<5);
        if(collision){stun=.85;progress=Math.max(0,Math.min(1,progress+(progress<.5?-.03:.03)));crossingProgress[i]=progress;crossingStun[i]=stun;}
      }
      if(stun>0)y+=Math.abs(Math.sin(now*.018+i))*2;
      g.fillStyle="#536346";g.fillRect(x-2,y-6,4,7);
      g.fillStyle="#9f6949";g.beginPath();g.arc(x,y-8,2,0,Math.PI*2);g.fill();
      if(stun>0){g.strokeStyle="#39462f";g.lineWidth=1.5;g.beginPath();g.moveTo(x-3,y-5);g.lineTo(x-6,y-9);g.moveTo(x+3,y-5);g.lineTo(x+6,y-9);g.stroke();}
    }
    for(let i=0;i<8;i++){
      const patrol=now*.00042+i*1.7,x=w*(.39+(i%4)*.045)+Math.cos(patrol)*w*.009,y=h*(.57+Math.floor(i/4)*.045)+Math.sin(patrol)*h*.012;
      g.fillStyle="#41583b";g.fillRect(x-3,y-8,6,9);
      g.fillStyle="#a66f48";g.beginPath();g.arc(x,y-10,2.4,0,Math.PI*2);g.fill();
      g.strokeStyle="#29382d";g.lineWidth=1.5;g.beginPath();g.moveTo(x+2,y-6);g.lineTo(x+7,y-7);g.stroke();
    }
    const hx=w*.75-pose.travel*w*.6,hy=h*.64-pose.lift*h*.22-pose.travel*h*.16;
    if(pose.travel<.87){g.save();g.translate(hx,hy);g.fillStyle="#526948";g.beginPath();g.ellipse(0,0,w*.035,h*.035,0,0,Math.PI*2);g.fill();g.fillRect(w*.025,-2,w*.04,4);g.fillStyle="#304c50";g.beginPath();g.ellipse(-w*.018,-2,w*.015,h*.025,0,0,Math.PI*2);g.fill();g.strokeStyle="#24342b";g.lineWidth=3;g.beginPath();g.moveTo(-w*.06,-h*.04);g.lineTo(w*.06,-h*.04);g.moveTo(-w*.02,h*.04);g.lineTo(w*.03,h*.04);g.stroke();g.restore();}
    if(canvas.dataset.cityReady!=="true"){canvas.dataset.cityReady="true";onReady();}
    if(pose.complete&&!done&&active!=="home"){done=true;onComplete(active);}
  }
  raf=requestAnimationFrame(frame);
  return()=>{stopped=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener("resize",resize);};
}
