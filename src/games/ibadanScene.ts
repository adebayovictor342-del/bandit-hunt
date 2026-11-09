import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cityFlightAt, type CityFlightMode, type CityFlightProgress } from "./cityFlight";

/** Offline OSM-derived building footprints and named streets around Dugbe. */
export interface IbadanMap {
  buildings: [number, number, number, number, number, number][];
  roads: { name: string; type: string; points: [number, number][] }[];
}
export interface CityOptions {
  canvas: HTMLCanvasElement;
  billboards: (HTMLDivElement | null)[];
  clouds: HTMLDivElement | null;
  flight: () => CityFlightMode;
  data: IbadanMap;
  paused: () => boolean;
  onProgress: (state: CityFlightProgress) => void;
  onComplete: (mode: Exclude<CityFlightMode, "home">) => void;
  onReady: () => void;
}
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Real-time 3D city. Repeated buildings, people and traffic use GPU instancing. */
export function createIbadanScene({ canvas, billboards, clouds: cloudLayer, flight: flightMode, data, paused, onProgress, onComplete, onReady }: CityOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1 : 1.25);
  renderer.setPixelRatio(pixelRatio);
  canvas.dataset.renderMode = "webgl";
  canvas.dataset.buildings = String(data.buildings.length);
  canvas.dataset.people = "46";
  canvas.dataset.vehicles = "20";
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9ac9df");
  scene.fog = new THREE.Fog("#b7d1d3", 65, 170);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 420);
  scene.add(new THREE.HemisphereLight(0xf5f4db, 0x5d7453, 2.15));
  const sun = new THREE.DirectionalLight(0xfff2d7, 2.0);
  sun.position.set(-50, 95, 55); scene.add(sun);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const sphere = new THREE.SphereGeometry(1, 8, 6);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const pitchedRoof = new THREE.ConeGeometry(1, 1, 4);
  pitchedRoof.rotateY(Math.PI / 4);
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  function mat(color: string | number) {
    const key = String(color);
    let m = materials.get(key);
    if (!m) { m = new THREE.MeshLambertMaterial({ color }); materials.set(key, m); }
    return m;
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string | number, parent: THREE.Object3D = scene) {
    const m = new THREE.Mesh(cube, mat(color)); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
  }
  function round(x: number, y: number, z: number, radius: number, h: number, color: string | number, parent: THREE.Object3D = scene) {
    const m = new THREE.Mesh(cylinder, mat(color)); m.position.set(x, y, z); m.scale.set(radius, h, radius); parent.add(m); return m;
  }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  function instances(count: number, geometry: THREE.BufferGeometry = cube, material: THREE.Material = mat("#ffffff")) {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, count)); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m;
  }
  function set(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, w: number, h: number, d: number, rotation = 0, tint?: string | number) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, rotation, 0); dummy.scale.set(w, h, d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (tint !== undefined) { color.set(tint); mesh.setColorAt(i, color); }
  }

  // Land and a warm distant Ibadan skyline.
  box(0, -0.4, 0, 260, 0.8, 250, "#82996c");
  const roofColors = ["#a65e43", "#8b5747", "#be7955", "#a36952", "#735b50", "#c4865d", "#8c6852"];
  const wallColors = ["#d7c5a8", "#cbb69a", "#e0d1b9", "#b8ab98", "#d2c0a9", "#c8a995", "#c1b5a5"];
  const n = data.buildings.length;
  const walls = instances(n); const roofs = instances(n, pitchedRoof); const windows = instances(n * 2);
  data.buildings.forEach(([x,z,w,d,h,k], i) => {
    // Leave a clear space for the fictional operations base and market.
    if ((x > 22 && x < 49 && z > 12 && z < 34) || (x > -30 && x < -7 && z > 8 && z < 25) || (Math.abs(x + 5.5) < 3 && Math.abs(z) < 3)) {
      set(walls,i,0,-100,0,.01,.01,.01); set(roofs,i,0,-100,0,.01,.01,.01); set(windows,i*2,0,-100,0,.01,.01,.01); set(windows,i*2+1,0,-100,0,.01,.01,.01); return;
    }
    set(walls,i,x,h/2,z,w,h,d,0,wallColors[k%wallColors.length]);
    const roofHeight = Math.max(.18, Math.min(.65, Math.min(w,d)*.23));
    set(roofs,i,x,h+roofHeight*.5,z,w*.78,roofHeight,d*.78,0,roofColors[k%roofColors.length]);
    for(let j=0;j<2;j++) set(windows,i*2+j,x+(j?1:-1)*w*.22,h*.58,z+d*.5+.025,Math.max(.12,w*.18),Math.max(.13,h*.24),.03,0,"#687977");
  });
  walls.instanceMatrix.needsUpdate=true; roofs.instanceMatrix.needsUpdate=true; windows.instanceMatrix.needsUpdate=true;
  const hills=instances(9,sphere);
  for(let i=0;i<9;i++)set(hills,i,-100+i*25,-1,-87+hash(i)*15,22,6+hash(i+22)*8,16,0,i%2?"#8da98a":"#9cb198");
  hills.instanceMatrix.needsUpdate=true;
  const clouds=instances(24,sphere);
  for(let i=0;i<24;i++){const group=Math.floor(i/4),j=i%4;set(clouds,i,-90+group*30+j*2.2,39+hash(group+6)*8+(j%2),-105,4+j*.25,1.8+j*.1,2,0,"#f3f4e5");}
  clouds.instanceMatrix.needsUpdate=true;
  const distantClouds=instances(20,sphere);
  for(let i=0;i<20;i++){
    const x=-45+hash(i+420)*100,z=-75-hash(i+720)*20;
    set(distantClouds,i,x,25+hash(i+510)*22,z,3+hash(i+830)*5,1.4+hash(i+930)*2.2,2.2+hash(i+1030)*3,0,i%3?"#f1f3e8":"#e7eee8");
  }
  distantClouds.instanceMatrix.needsUpdate=true;
  const cloudBank = instances(16, sphere);
  for (let i=0;i<16;i++) set(cloudBank,i,-39+(i%4)*7,17+Math.floor(i/4)*2.5,-28+Math.floor(i/4)*6,7,3.4,5,0,i%2?"#eaf0e8":"#d9e5e1");
  cloudBank.instanceMatrix.needsUpdate=true;
  const trunks=instances(70,cylinder),leaves=instances(70,cone);
  for(let i=0;i<70;i++){
    const x=-60+hash(i+912)*120,z=-45+hash(i+138)*95;
    if((x>21&&x<49&&z>12&&z<34)||Math.abs(z-3)<6){set(trunks,i,0,-100,0,.01,.01,.01);set(leaves,i,0,-100,0,.01,.01,.01);continue;}
    set(trunks,i,x,.7,z,.12,1.4,.12,0,"#6e634a");set(leaves,i,x,1.65,z,.85,1.8,.85,0,i%3?"#6f8e5a":"#839c68");
  }
  trunks.instanceMatrix.needsUpdate=true;leaves.instanceMatrix.needsUpdate=true;

  // Real OSM street paths, clipped to the local playable district.
  const segments: {x:number;z:number;length:number;angle:number;width:number}[] = [];
  for (const road of data.roads) for (let i=1;i<road.points.length;i++) {
    const [x1,z1]=road.points[i-1], [x2,z2]=road.points[i];
    if (Math.max(Math.abs(x1),Math.abs(x2),Math.abs(z1),Math.abs(z2))>85) continue;
    const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz); if(len<.1) continue;
    segments.push({x:(x1+x2)/2,z:(z1+z2)/2,length:len,angle:Math.atan2(dx,dz),width:road.type==="trunk"?1.6:road.type==="primary"?1.3:.85});
  }
  const roads=instances(segments.length);
  segments.forEach((r,i)=>set(roads,i,r.x,.025,r.z,r.width,.05,r.length,r.angle,"#717975"));
  roads.instanceMatrix.needsUpdate=true;

  // Cocoa House, Dugbe: tall, narrow 26-storey landmark.
  const cocoaX=-6.9,cocoaZ=-.6;
  box(cocoaX,5.25,cocoaZ,2.8,10.5,2.8,"#d2cbb8");
  for(let k=0;k<18;k++) box(cocoaX,1+k*.49,cocoaZ+1.43,2.35,.17,.025,"#728b8e");
  box(cocoaX,10.6,cocoaZ,3,.22,3,"#b7aa91");
  // Stylized Mapo Hall and Bower's Tower on the distant hills.
  box(-42,2,-32,10,4,5,"#dbd2b9"); box(-42,4.2,-32,11,.35,5.5,"#eee2c8");
  for(let i=0;i<7;i++) round(-46.5+i*1.5,1.8,-29.3,.24,3.2,"#eee4d0");
  const pediment=new THREE.Mesh(cone,mat("#c6bba4"));pediment.position.set(-42,5,-32);pediment.scale.set(5.8,1.5,2.8);pediment.rotation.y=Math.PI/4;scene.add(pediment);
  round(40,3,-37,.8,6,"#d8d1ba"); round(40,6.15,-37,1,.3,"#eee6d2");

  // Elevated flyover with an arcing approach and slim support columns.
  function roadZ(x:number){ return 3+Math.sin((x+12)*.025)*5; }
  function roadY(x:number){ return .16+smooth(-62,-29,x)*2.8*(1-smooth(40,68,x)); }
  const roadCount=74, fly=instances(roadCount), rails=instances(roadCount*2), markings=instances(roadCount);
  for(let i=0;i<roadCount;i++){
    const x=-67+i*1.85,z=roadZ(x),y=roadY(x),a=Math.atan2(roadZ(x+1)-z,1);
    set(fly,i,x,y,z,2.05,.35,4.9,-a,"#596563");
    set(rails,i*2,x,y+.35,z-2.45,2.1,.5,.12,-a,"#adb7a5");set(rails,i*2+1,x,y+.35,z+2.45,2.1,.5,.12,-a,"#adb7a5");
    set(markings,i,x,y+.185,z,1.1,.025,.06,-a,"#d9d9bd");
    if(i%9===0&&y>1) box(x,y/2,z,.55,y,.8,"#a9ad9b");
  }
  fly.instanceMatrix.needsUpdate=true;rails.instanceMatrix.needsUpdate=true;markings.instanceMatrix.needsUpdate=true;
  // A blue covered pedestrian bridge across the flyover.
  const bridgeX=-2, bridgeZ=roadZ(bridgeX), bridgeY=roadY(bridgeX)+2.3;
  box(bridgeX,bridgeY,bridgeZ,2.4,.25,14,"#a4a99c");
  box(bridgeX,bridgeY+2.35,bridgeZ,3,.22,14.5,"#4f91a8");
  for(let i=0;i<8;i++){
    const z=bridgeZ-6.8+i*1.9;
    box(bridgeX-1.15,bridgeY+1.05,z,.12,2.1,.12,"#366c7b");
    box(bridgeX+1.15,bridgeY+1.05,z,.12,2.1,.12,"#366c7b");
  }
  box(bridgeX-1.15,bridgeY+.85,bridgeZ,.1,.1,14,"#3d7383");
  box(bridgeX+1.15,bridgeY+.85,bridgeZ,.1,.1,14,"#3d7383");
  for(const side of [-1,1]){
    const ramp=box(bridgeX,bridgeY/2,bridgeZ+side*9.8,2.2,.2,6,"#a4aa9b");ramp.rotation.x=side*.48;
    box(bridgeX,bridgeY/2,bridgeZ+side*12.3,.3,bridgeY, .3,"#86988a");
  }

  // Dugbe-style open market: parasols, stalls and animated vendors.
  const umbrellas=["#dd6d49","#dfbc4a","#619bb2","#89a35e","#b65d65","#e4d2a0"];
  for(let row=0;row<4;row++)for(let col=0;col<7;col++){
    const x=-28+col*2.8+hash(row*10+col)*.45,z=10+row*3;
    box(x,.38,z,1.45,.76,1.15,"#a18055");round(x,1.0,z,.05,1.95,"#755d43");
    const shade=new THREE.Mesh(cone,mat(umbrellas[(row+col)%umbrellas.length]));shade.position.set(x,2,z);shade.scale.set(1.05,.5,1.05);scene.add(shade);
    box(x,.84,z,.85,.13,.8,(col%2?"#a94c3c":"#778c50"));
  }

  // Fictional operations base, with fence, pad and grounded support vehicles.
  box(34,.12,24,24,.2,20,"#9b9f8d");
  for(const z of [14,34]) { box(34,1.3,z,24,.18,.18,"#565f52"); for(let x=22;x<=46;x+=3) box(x,1.2,z,.12,2.3,.12,"#667063"); }
  for(const x of [22,46]) { box(x,1.3,24,.18,.18,20,"#565f52"); for(let z=14;z<=34;z+=3)box(x,1.2,z,.12,2.3,.12,"#667063"); }
  const pad=new THREE.Mesh(new THREE.CircleGeometry(4.5,32),mat("#4f6260"));pad.rotation.x=-Math.PI/2;pad.position.set(33,.25,24);scene.add(pad);
  const ring=new THREE.Mesh(new THREE.RingGeometry(3.3,3.45,32),new THREE.MeshBasicMaterial({color:"#e4d48a",side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(33,.28,24);scene.add(ring);
  box(33,.3,24,.3,.03,2.2,"#e8e0b6");box(33,.3,24,1.7,.03,.3,"#e8e0b6");
  box(41,1.3,18,7,2.6,3.5,"#bcb8a2");box(41,2.7,18,7.4,.25,3.9,"#6b7865");
  for(let i=0;i<4;i++){
    const x=26+i*3,z=30;
    box(x,.6,z,2.1,.7,1.35,"#485d3f");box(x,1.1,z,1.2,.4,.9,"#677853");
    box(x-1,1.15,z,1.7,.13,.13,"#3f4a38");box(x,.23,z,2.1,.25,1.6,"#242d26");
  }

  // Five real 3D frames; accessible DOM creatives are projected onto each.
  const signs: THREE.Group[] = [];
  const signPositions: [number, number, number][] = [[-43,0,15],[-19,0,22],[8,0,-8],[27,0,-8],[43,0,5]];
  for (const position of signPositions) {
    const [x,y,z] = position;
    const base=new THREE.Group();base.position.set(x,y,z);scene.add(base);
    for(const postX of [-2.6,2.6]) box(postX,3.3,0,.3,6.6,.35,"#697a69",base);
    const sign=new THREE.Group();sign.position.y=7.2;base.add(sign);
    box(0,0,0,11.2,5.8,.3,"#28352f",sign);box(0,0,.17,10.7,5.3,.06,"#12302c",sign);
    signs.push(sign);
  }

  // Animated vehicles: three instanced draw calls for the whole traffic fleet.
  const cars=instances(20), carTops=instances(20), carUnder=instances(20);
  const carX = new Float32Array(20), carZ = new Float32Array(20), carY = new Float32Array(20);
  const crossingProgress = Array.from({ length: 8 }, (_, i) => (i * .17) % 1);
  const crossingStun = new Float32Array(8);
  const soldierPosts: [number, number][] = [[25,17],[34,17],[43,17],[25,31],[43,31],[29,27],[39,27],[34,21]];
  const carColors=["#e3b336","#e7bc40","#c6c8b8","#465d63","#8f5350","#d7a432"];
  for(let i=0;i<20;i++){cars.setColorAt(i,color.set(carColors[i%carColors.length]));carTops.setColorAt(i,color.set(i%3===0?"#637f82":"#d4d4b8"));carUnder.setColorAt(i,color.set("#262d2a"));}

  // Animated crowds: separately instanced body, head, limbs and tiny shadows.
  const personCount=46;
  const bodies=instances(personCount),heads=instances(personCount,sphere),hair=instances(personCount,sphere),arms=instances(personCount*2),legs=instances(personCount*2);
  const soldierTools=instances(8);
  for(let i=0;i<8;i++){color.set("#273329");soldierTools.setColorAt(i,color);}
  const outfits=["#d7b06a","#e4ddd0","#608aa0","#ba6e52","#6f895d","#6f6978","#476054"];
  for(let i=0;i<personCount;i++){
    bodies.setColorAt(i,color.set(i>=38?"#556d46":outfits[i%outfits.length]));heads.setColorAt(i,color.set(i%3===0?"#825333":"#a66f48"));hair.setColorAt(i,color.set(i>=38?"#526845":"#292823"));
    for(let j=0;j<2;j++){arms.setColorAt(i*2+j,color.set(i%3===0?"#825333":"#a66f48"));legs.setColorAt(i*2+j,color.set(i>=38?"#394b32":"#333f3a"));}
  }

  // The player's helicopter is actual geometry, not a photograph.
  const heli=new THREE.Group();scene.add(heli);
  const fuselage=new THREE.Mesh(sphere,mat("#526948"));fuselage.scale.set(2.5,1.15,1.15);heli.add(fuselage);
  const nose=new THREE.Mesh(sphere,mat("#304c50"));nose.position.set(-1.25,.16,0);nose.scale.set(1.0,.75,.94);heli.add(nose);
  box(2.5,.25,0,3.1,.36,.36,"#526948",heli);box(4,.7,0,.5,1.4,.12,"#425740",heli);
  box(-1,-1.1,-.7,3,.12,.1,"#293b32",heli);box(-1,-1.1,.7,3,.12,.1,"#293b32",heli);
  for(const x of [-1.9,.05])for(const z of [-.7,.7])box(x,-.75,z,.08,.7,.08,"#293b32",heli);
  round(0,1.25,0,.16,.65,"#303a31",heli);
  const rotor=new THREE.Group();rotor.position.y=1.65;heli.add(rotor);
  box(0,0,0,9.4,.07,.21,"#2a3933",rotor);box(0,.04,0,.21,.07,9.4,"#2a3933",rotor);
  const tailRotor=new THREE.Group();tailRotor.position.set(4,.4,.28);heli.add(tailRotor);
  box(0,0,0,.08,2.2,.12,"#222f29",tailRotor);box(0,0,0,2.2,.08,.12,"#222f29",tailRotor);
  const cabin=box(-.65,.08,1.02,1.85,.72,.1,"#8ab5b0",heli);cabin.rotation.z=-.08;
  box(-.45,.08,1.09,.09,.75,.06,"#d4d4b4",heli);
  box(-1.18,.08,1.09,.08,.75,.06,"#d4d4b4",heli);
  box(.72,-.04,1.02,.65,.7,.09,"#718e7f",heli);
  box(.72,-.43,1.08,1.1,.09,.06,"#c2c5a9",heli);
  box(1.0,.95,0,1.1,.35,.65,"#3d523b",heli);
  box(3.2,.1,0,.7,.08,1.5,"#425740",heli);
  heli.position.set(33,1.35,24);

  // Bake static primitive colors into vertices and merge them into one draw
  // call. The helicopter's body is also merged; its rotors remain animated.
  function mergeStaticChildren(parent: THREE.Object3D) {
    const objects = parent.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh) && [cube, cylinder, cone, sphere].includes(object.geometry as THREE.BoxGeometry));
    if (objects.length < 2) return;
    const geometries: THREE.BufferGeometry[] = [];
    for (const object of objects) {
      object.updateMatrix();
      const geometry = object.geometry.clone().applyMatrix4(object.matrix);
      const shade = (object.material as THREE.MeshLambertMaterial).color ?? new THREE.Color("#ffffff");
      const values = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < values.length; i += 3) { values[i] = shade.r; values[i + 1] = shade.g; values[i + 2] = shade.b; }
      geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
      geometries.push(geometry);
    }
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!merged) return;
    for (const object of objects) parent.remove(object);
    const mergedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    materials.set(`merged-${materials.size}`, mergedMaterial);
    parent.add(new THREE.Mesh(merged, mergedMaterial));
  }
  mergeStaticChildren(scene);
  mergeStaticChildren(heli);
  for (const sign of signs) mergeStaticChildren(sign);

  let elapsed=0,last=performance.now(),raf=0,stopped=false,completed=false,lastSeconds=-1,lastRender=0;
  let activeFlight: CityFlightMode = flightMode();
  let homeClock=0,homeOrbit=0;
  let progressTick=-1;
  canvas.dataset.billboards=String(signs.length);
  let sampleStart=performance.now(),sampleFrames=0;
  const frameInterval=window.matchMedia("(pointer: coarse)").matches?1000/45:1000/60;
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let viewportWidth=1,viewportHeight=1;
  const canvasWidth=()=>Math.max(1,canvas.parentElement?.clientWidth ?? 1);
  const canvasHeight=()=>Math.max(1,canvas.parentElement?.clientHeight ?? 1);
  function resize(){viewportWidth=canvasWidth();viewportHeight=canvasHeight();renderer.setSize(viewportWidth,viewportHeight,false);camera.aspect=viewportWidth/viewportHeight;camera.updateProjectionMatrix();}
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;
  if(canvas.parentElement)observer?.observe(canvas.parentElement);window.addEventListener("resize",resize);resize();
  const cornerA=new THREE.Vector3(),cornerB=new THREE.Vector3();
  function projectBillboards(hidden: boolean){
    for (let i=0;i<signs.length;i++) {
      const billboard=billboards[i];
      if (!billboard) continue;
      const sign=signs[i];
      sign.lookAt(camera.position);sign.updateWorldMatrix(true,false);
      cornerA.set(-5.25,2.55,.23).applyMatrix4(sign.matrixWorld).project(camera);
      cornerB.set(5.25,-2.55,.23).applyMatrix4(sign.matrixWorld).project(camera);
      const w=viewportWidth,h=viewportHeight,left=(Math.min(cornerA.x,cornerB.x)+1)*w/2,top=(1-Math.max(cornerA.y,cornerB.y))*h/2;
      const width=Math.abs(cornerB.x-cornerA.x)*w/2,height=Math.abs(cornerB.y-cornerA.y)*h/2;
      const visible=!hidden&&cornerA.z<1&&cornerB.z<1&&width>12&&left<w&&left+width>0&&top<h&&top+height>0;
      billboard.style.visibility=visible?"visible":"hidden";
      if(visible){billboard.style.width=`${Math.round(width)}px`;billboard.style.height=`${Math.round(height)}px`;billboard.style.transform=`translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;}
      else billboard.style.transform="translate3d(-10000px,-10000px,0)";
    }
  }
  function frame(now:number){
    if(stopped)return;
    raf=requestAnimationFrame(frame);
    if(document.hidden){last=now;return;}
    // Cap to 45 fps on touch devices; simulation uses real elapsed time.
    if(now-lastRender<frameInterval-1)return;
    const dt=Math.min(.25,Math.max(0,(now-last)/1000));last=now;lastRender=now;
    sampleFrames++;
    if(now-sampleStart>=1800){
      const fps=Math.round(sampleFrames*1000/(now-sampleStart));
      canvas.dataset.fps=String(fps);canvas.dataset.drawCalls=String(renderer.info.render.calls);
      sampleStart=now;sampleFrames=0;
    }
    const nextFlight=flightMode();
    if(nextFlight!==activeFlight){activeFlight=nextFlight;elapsed=0;completed=false;progressTick=-1;}
    if(activeFlight!=="home"&&!paused()) elapsed+=dt;
    const pose=cityFlightAt(activeFlight,elapsed);
    const tick=Math.floor(elapsed*5);
    const changedSecond=pose.remaining!==lastSeconds;
    if(tick!==progressTick||changedSecond){progressTick=tick;lastSeconds=pose.remaining;onProgress(pose);}
    canvas.dataset.flightMode=activeFlight;
    canvas.dataset.flightSeconds=String(pose.remaining);
    if(cloudLayer){cloudLayer.style.opacity=String(pose.cloud);cloudLayer.dataset.cloud=pose.cloud>.98?"covered":pose.cloud>.02?"transition":"clear";}
    const { lift,travel }=pose;
    // Stay inside the mapped city. Dense cloud banks conceal the boundary and
    // the helicopter before the mission handoff.
    heli.position.set(33-travel*58,1.35+lift*10+travel*11,24-travel*46);
    heli.visible=travel<.87;
    if(changedSecond||activeFlight==="home"&&Math.floor(now/1000)!==Math.floor((now-dt*1000)/1000)){
      canvas.dataset.helicopterX=heli.position.x.toFixed(2);canvas.dataset.helicopterY=heli.position.y.toFixed(2);
      canvas.dataset.peoplePosition=String(Math.round((-42+((now/1000*.35)%84))*100)/100);
      canvas.dataset.trafficPosition=String(Math.round((-60+((now/1000*5+6000)%120))*100)/100);
    }
    heli.rotation.y=travel*.28;
    heli.rotation.z=travel*.035;
    rotor.rotation.y+=dt*(activeFlight==="home"?3:15+lift*30);tailRotor.rotation.z+=dt*(activeFlight==="home"?4:30);
    homeClock+=dt;
    if(activeFlight==="home"&&!paused()&&!reducedMotion) homeOrbit=Math.sin(homeClock*.045)*1.4;
    const camX=mix(55+homeOrbit,heli.position.x+19,travel),camY=mix(25,heli.position.y+15,travel),camZ=mix(57,heli.position.z+26,travel);
    camera.position.set(camX,camY,camZ);
    camera.lookAt(mix(7,heli.position.x-5,travel),mix(2.2,heli.position.y-1,travel),mix(4,heli.position.z-8,travel));
    camera.updateMatrixWorld();
    const anim=now/1000;
    for(let i=0;i<20;i++){
      const direction=i%2===0?1:-1;
      const x=-60+((i*13+anim*(5+i%3)*direction+6000)%120);
      const z=roadZ(x)+(direction>0?-.9:.9),y=roadY(x)+.54,a=-Math.atan2(roadZ(x+1)-roadZ(x),1);
      carX[i]=x;carZ[i]=z;carY[i]=y;
      set(cars,i,x,y,z,1.8,.58,.9,a);set(carTops,i,x,y+.4,z,.9,.3,.8,a);set(carUnder,i,x,y-.37,z,1.55,.18,1.05,a);
    }
    cars.instanceMatrix.needsUpdate=true;carTops.instanceMatrix.needsUpdate=true;carUnder.instanceMatrix.needsUpdate=true;
    for(let i=0;i<personCount;i++){
      const market=i>=22&&i<38,soldier=i>=38;
      let x:number, z:number, personY:number;
      if(i<crossingProgress.length){
        x=-46+i*12;
        if(crossingStun[i]>0)crossingStun[i]=Math.max(0,crossingStun[i]-dt);
        else crossingProgress[i]=(crossingProgress[i]+dt*.14)%1;
        z=roadZ(x)-5.8+crossingProgress[i]*11.6;
        personY=roadY(x)+.48;
        if(crossingStun[i]===0){
          for(let car=0;car<carX.length;car++){
            if(Math.abs(carX[car]-x)<2.15&&Math.abs(carZ[car]-z)<1.55&&Math.abs(carY[car]-personY)<.9){
              crossingStun[i]=.85;
              crossingProgress[i]=Math.max(0,Math.min(1,crossingProgress[i]+Math.sign(z-carZ[car]||1)*.025));
              break;
            }
          }
        }
      } else if(soldier){
        const [postX,postZ]=soldierPosts[i-38];
        const patrol=anim*.42+i*1.7;
        x=postX+Math.cos(patrol)*1.4;
        z=postZ+Math.sin(patrol)*1.1;
        personY=.48;
        set(soldierTools,i-38,x+.24,personY+.56,z,.85,.075,.075,Math.sin(patrol)*.16);
      } else {
        x=market?-27+(i-22)%7*2.8+Math.sin(anim*.32+i)*.3:-42+((i*5.2+anim*(.35+i%3*.08))%84);
        z=market?11+Math.floor((i-22)/7)*3:roadZ(x)+4+(i%2)*1.1;
        personY=.48;
      }
      const startled=i<crossingStun.length&&crossingStun[i]>0;
      if(startled){x+=Math.sin(anim*18+i)*.28;personY+=Math.abs(Math.sin(anim*18+i))*.1;}
      const wave=startled?Math.sin(anim*18+i)*.9:soldier?Math.sin(anim*2.7+i)*.75:market?Math.sin(anim*2.2+i)*.35:Math.sin(anim*5+i)*.55;
      set(bodies,i,x,personY,z,.25,.46,.16,0);set(heads,i,x,personY+.35,z,.14,.14,.14,0);set(hair,i,x,personY+.44,z,.145,.055,.145,0);
      for(let j=0;j<2;j++){
        const side=j?1:-1;
        // Swing around the shoulder/hip, rather than spinning on the spot.
        dummy.position.set(x+side*.19,personY+(market&&j===1?.07:0),z);
        dummy.rotation.set(0,0,startled?wave*side:market&&j===1 ? -.75+wave*.3 : wave*side);
        dummy.scale.set(.08,.36,.08);dummy.updateMatrix();arms.setMatrixAt(i*2+j,dummy.matrix);
        dummy.position.set(x+side*.07,personY-.31,z+wave*side*.08);
        dummy.rotation.set(0,0,market?wave*.12:-wave*side);
        dummy.scale.set(.09,.32,.1);dummy.updateMatrix();legs.setMatrixAt(i*2+j,dummy.matrix);
      }
    }
    for(const mesh of [bodies,heads,hair,arms,legs,soldierTools])mesh.instanceMatrix.needsUpdate=true;
    projectBillboards(pose.cloud>.65);renderer.render(scene,camera);
    if(canvas.dataset.cityReady!=="true"){canvas.dataset.cityReady="true";onReady();}
    if(pose.complete&&!completed&&activeFlight!=="home"){completed=true;onComplete(activeFlight);}
  }
  raf=requestAnimationFrame(frame);
  return () => {
    stopped=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener("resize",resize);
    scene.traverse(obj=>{const m=obj as THREE.Mesh;if(m.geometry && m.geometry!==cube && m.geometry!==cylinder && m.geometry!==sphere && m.geometry!==cone)m.geometry.dispose();});
    cube.dispose();cylinder.dispose();sphere.dispose();cone.dispose();pitchedRoof.dispose();for(const m of materials.values())m.dispose();(ring.material as THREE.Material).dispose();renderer.dispose();renderer.forceContextLoss();
  };
}
