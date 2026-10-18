(() => {
"use strict";
const $ = id => document.getElementById(id);
const canvas = $("glcanvas"), gl = canvas.getContext("webgl", {antialias:true, alpha:false});
if (!gl) { $("hint").textContent = "WebGL is unavailable in this browser. Try enabling hardware acceleration."; throw new Error("WebGL unavailable"); }
const vs = `attribute vec3 aPos; attribute vec3 aNormal; uniform mat4 uMVP; uniform mat4 uModel; varying vec3 vN; varying vec3 vP; void main(){vec4 p=uModel*vec4(aPos,1.0);vP=p.xyz;vN=mat3(uModel)*aNormal;gl_Position=uMVP*vec4(aPos,1.0);}`;
const fs = `precision mediump float; uniform vec3 uColor; uniform float uMetal; uniform float uRough; uniform vec3 uLight; varying vec3 vN; varying vec3 vP; void main(){vec3 n=normalize(vN);vec3 l=normalize(uLight-vP);float diff=max(dot(n,l),0.0);vec3 view=normalize(vec3(0.0,0.0,7.0)-vP);vec3 h=normalize(l+view);float spec=pow(max(dot(n,h),0.0),mix(64.0,5.0,uRough))*(0.15+uMetal*0.8);vec3 base=uColor*(0.22+diff*0.78);base=mix(base,base+vec3(.55,.6,1.0)*spec,uMetal*.8+0.2);gl_FragColor=vec4(base,1.0);}`;
function shader(type, src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const loc={pos:gl.getAttribLocation(program,"aPos"),normal:gl.getAttribLocation(program,"aNormal"),mvp:gl.getUniformLocation(program,"uMVP"),model:gl.getUniformLocation(program,"uModel"),color:gl.getUniformLocation(program,"uColor"),metal:gl.getUniformLocation(program,"uMetal"),rough:gl.getUniformLocation(program,"uRough"),light:gl.getUniformLocation(program,"uLight")};
const objects=[];let selected=0,nextId=1,showGrid=true, cameraYaw=.65,cameraPitch=.3,cameraDist=7,drag=null,lastPointer=null,sessionToken="",sessionPoll=null,lastMotionAt=0,baseline=null,controlMode=0,sensitivity=1,phoneConnected=false;
function obj(shape){return {id:nextId++,shape,name:shape[0].toUpperCase()+shape.slice(1)+" "+String(nextId-1).padStart(2,"0"),pos:[0,0,0],rot:[0,0,0],scale:[1,1,1],color:"#6d72ff",metal:.42,rough:.32,visible:true,texture:null,textureImage:null};}
objects.push(obj("cube"));
const hexRGB=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
function vsub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function norm(a){let d=Math.hypot(...a)||1;return a.map(x=>x/d)}
function geometry(shape){
 if(shape==="uploaded" && current().customGeometry) return current().customGeometry;
 let p=[],n=[],uv=[];
 function tri(a,b,c,normal){let nn=normal||norm(cross(vsub(b,a),vsub(c,a)));for(const q of [a,b,c]){p.push(...q);n.push(...nn);uv.push((q[0]+1)/2,(q[1]+1)/2)}}
 function quad(a,b,c,d,normal){tri(a,b,c,normal);tri(a,c,d,normal)}
 if(shape==="cube"){let faces=[[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1],[1,0,0]],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1],[-1,0,0]],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1],[0,1,0]],[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1],[0,-1,0]],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]]];faces.forEach(f=>quad(...f.slice(0,4),f[4]));}
 else if(shape==="pyramid"){let a=[-1,-1,-1],b=[1,-1,-1],c=[1,-1,1],d=[-1,-1,1],t=[0,1.5,0];quad(a,d,c,b,[0,-1,0]);tri(a,b,t);tri(b,c,t);tri(c,d,t);tri(d,a,t);}
 else if(shape==="prism"){let A=[-1,-1,-.7],B=[1,-1,-.7],C=[0,1,-.7],D=[-1,-1,.7],E=[1,-1,.7],F=[0,1,.7];tri(A,B,C);tri(D,F,E);quad(A,D,E,B);quad(B,E,F,C);quad(C,F,D,A);}
 else if(shape==="plane"){quad([-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[0,0,1]);}
 else {let rings=shape==="sphere"?20:1, seg=shape==="sphere"?28:32, stacks=shape==="sphere"?16:24;
  if(shape==="sphere"){for(let j=0;j<stacks;j++){let v0=-Math.PI/2+Math.PI*j/stacks,v1=-Math.PI/2+Math.PI*(j+1)/stacks;for(let i=0;i<seg;i++){let a=i*2*Math.PI/seg,b=(i+1)*2*Math.PI/seg;let point=(v,t)=>[Math.cos(v)*Math.cos(t),Math.sin(v),Math.cos(v)*Math.sin(t)];quad(point(v0,a),point(v0,b),point(v1,b),point(v1,a));}}}
  else if(shape==="torus"){let major=1,minor=.35;for(let j=0;j<24;j++)for(let i=0;i<32;i++){let pt=(u,v)=>[(major+minor*Math.cos(v))*Math.cos(u),minor*Math.sin(v),(major+minor*Math.cos(v))*Math.sin(u)],u=i*2*Math.PI/32,u1=(i+1)*2*Math.PI/32,v=j*2*Math.PI/24,v1=(j+1)*2*Math.PI/24;quad(pt(u,v),pt(u1,v),pt(u1,v1),pt(u,v1));}}
  else {let radius=1,top=shape==="cone",bottom=shape==="cylinder";for(let i=0;i<seg;i++){let a=i*2*Math.PI/seg,b=(i+1)*2*Math.PI/seg,pa=[Math.cos(a),-1,Math.sin(a)],pb=[Math.cos(b),-1,Math.sin(b)],ta=[top?0:Math.cos(a),1,top?0:Math.sin(a)],tb=[top?0:Math.cos(b),1,top?0:Math.sin(b)];tri(pa,pb,tb);tri(pa,tb,ta);tri([0,-1,0],pb,pa,[0,-1,0]);if(bottom)tri([0,1,0],ta,tb,[0,1,0]);}}
 }
 return {p:new Float32Array(p),n:new Float32Array(n),uv:new Float32Array(uv)};
}
const geoCache={};function makeBuffer(data){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;}
function getGeo(shape){if(!geoCache[shape]){let g=geometry(shape);geoCache[shape]={p:makeBuffer(g.p),n:makeBuffer(g.n),count:g.p.length/3};}return geoCache[shape]}
function identity(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
function mul(a,b){let o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function translate(x,y,z){let m=identity();m[12]=x;m[13]=y;m[14]=z;return m}
function scaleM(x,y,z){let m=identity();m[0]=x;m[5]=y;m[10]=z;return m}
function rotateX(a){let c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]}
function rotateY(a){let c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]}
function rotateZ(a){let c=Math.cos(a),s=Math.sin(a);return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]}
function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2),nf=1/(near-far);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]}
function lookAt(eye,center,up){let z=norm(vsub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1]}
function modelMatrix(o){return mul(translate(...o.pos),mul(rotateY(o.rot[1]),mul(rotateX(o.rot[0]),mul(rotateZ(o.rot[2]),scaleM(...o.scale)))))}
function draw(){const w=canvas.clientWidth||800,h=canvas.clientHeight||500,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);gl.viewport(0,0,canvas.width,canvas.height)}gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.04,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=[cameraDist*Math.cos(cameraPitch)*Math.sin(cameraYaw),cameraDist*Math.sin(cameraPitch),cameraDist*Math.cos(cameraPitch)*Math.cos(cameraYaw)],view=lookAt(eye,[0,0,0],[0,1,0]),proj=perspective(Math.PI/4,canvas.width/canvas.height,.1,100),vp=mul(proj,view);
 if(showGrid){gl.disable(gl.DEPTH_TEST);const lines=[];for(let i=-10;i<=10;i++){lines.push(i*.25,-1.15,-2.5,i*.25,-1.15,2.5,-2.5,-1.15,i*.25,2.5,-1.15,i*.25)}const b=makeBuffer(new Float32Array(lines));const m=identity();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);gl.disableVertexAttribArray(loc.normal);gl.uniformMatrix4fv(loc.mvp,false,new Float32Array(vp));gl.uniformMatrix4fv(loc.model,false,new Float32Array(m));gl.uniform3f(loc.color,.12,.13,.23);gl.uniform1f(loc.metal,0);gl.uniform1f(loc.rough,1);gl.drawArrays(gl.LINES,0,lines.length/3);gl.deleteBuffer(b);gl.enable(gl.DEPTH_TEST)}
 for(let i=0;i<objects.length;i++){const o=objects[i];if(!o.visible)continue;const g=getGeo(o.shape),model=modelMatrix(o),mvp=mul(vp,model);gl.bindBuffer(gl.ARRAY_BUFFER,g.p);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,g.n);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);gl.uniformMatrix4fv(loc.mvp,false,new Float32Array(mvp));gl.uniformMatrix4fv(loc.model,false,new Float32Array(model));let c=hexRGB(o.color);if(i===selected)c=c.map(x=>Math.min(1,x*1.08+.04));gl.uniform3fv(loc.color,c);gl.uniform1f(loc.metal,o.metal);gl.uniform1f(loc.rough,o.rough);gl.uniform3f(loc.light,3,5,5);gl.drawArrays(gl.TRIANGLES,0,g.count)}
 requestAnimationFrame(draw)}
requestAnimationFrame(draw);
function current(){return objects[selected]||objects[0]}
function syncUI(){const o=current();if(!o)return;$("selectedName").textContent=o.name;$("selectedType").textContent=o.shape.toUpperCase()+" · GEOMETRY";$("nameInput").value=o.name;$("selectedName").textContent=o.name;$("posX").value=o.pos[0];$("posY").value=o.pos[1];$("posZ").value=o.pos[2];$("rotX").value=Math.round(o.rot[0]*180/Math.PI);$("rotY").value=Math.round(o.rot[1]*180/Math.PI);$("rotZ").value=Math.round(o.rot[2]*180/Math.PI);$("scaleX").value=o.scale[0];$("scaleY").value=o.scale[1];$("scaleZ").value=o.scale[2];$("colorInput").value=o.color;$("colorHex").textContent=o.color.toUpperCase();$("metalInput").value=o.metal;$("roughInput").value=o.rough;$("metalValue").textContent=Math.round(o.metal*100)+"%";$("roughValue").textContent=Math.round(o.rough*100)+"%";$("uniformScale").value=(o.scale[0]+o.scale[1]+o.scale[2])/3;$("uniformValue").textContent=(Number($("uniformScale").value)).toFixed(2)+"×";$("coords").textContent=`X ${o.pos[0].toFixed(2)}  Y ${o.pos[1].toFixed(2)}  Z ${o.pos[2].toFixed(2)}`;$("objectCount").textContent=String(objects.length).padStart(2,"0");document.querySelectorAll(".object-tile").forEach(b=>b.classList.toggle("selected",b.dataset.shape===o.shape));renderList()}
function renderList(){let list=$("sceneList");list.innerHTML="";objects.forEach((o,i)=>{let b=document.createElement("button");b.className="scene-item"+(i===selected?" active":"");let icon=document.createElement("span");icon.textContent=({cube:"⬡",sphere:"◉",pyramid:"△",cone:"◭",cylinder:"▤",prism:"◬",torus:"◎",plane:"▱",uploaded:"◈"})[o.shape]||"◈";let name=document.createElement("span");name.textContent=o.name;let kind=document.createElement("span");kind.className="scene-kind";kind.textContent=o.visible?"MESH":"HIDDEN";b.append(icon,name,kind);b.onclick=()=>{selected=i;syncUI()};list.appendChild(b)})}
function addShape(s){
 const previous=current();
 const replacement=obj(s);
 replacement.pos=[...previous.pos]; replacement.rot=[...previous.rot];
 replacement.scale=[...previous.scale]; replacement.color=previous.color;
 replacement.metal=previous.metal; replacement.rough=previous.rough;
 replacement.name=replacement.name;
 objects[selected]=replacement;
 syncUI();
}
document.querySelectorAll(".object-tile").forEach(b=>b.addEventListener("click",()=>addShape(b.dataset.shape)));
$("addBtn").onclick=()=>addShape("cube");
["posX","posY","posZ","rotX","rotY","rotZ","scaleX","scaleY","scaleZ"].forEach((id)=>$(id).addEventListener("input",()=>{let o=current(),map={posX:["pos",0,1],posY:["pos",1,1],posZ:["pos",2,1],rotX:["rot",0,Math.PI/180],rotY:["rot",1,Math.PI/180],rotZ:["rot",2,Math.PI/180],scaleX:["scale",0,1],scaleY:["scale",1,1],scaleZ:["scale",2,1]},[k,i,m]=map[id],v=Number($(id).value);if(Number.isFinite(v))o[k][i]=k==="scale"?Math.max(.05,Math.min(10,v)):Math.max(-1000,Math.min(1000,v))*m;syncUI()}));
$("nameInput").addEventListener("input",()=>{current().name=$("nameInput").value.slice(0,50)||"Object";$("selectedName").textContent=current().name;renderList()});
$("colorInput").oninput=()=>{current().color=$("colorInput").value;$("colorHex").textContent=current().color.toUpperCase()};
$("randomColor").onclick=()=>{current().color="#"+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,"0");syncUI()};
$("metalInput").oninput=()=>{current().metal=+$("metalInput").value;$("metalValue").textContent=Math.round(current().metal*100)+"%"};
$("roughInput").oninput=()=>{current().rough=+$("roughInput").value;$("roughValue").textContent=Math.round(current().rough*100)+"%"};
$("uniformScale").oninput=()=>{let v=+$("uniformScale").value;current().scale=[v,v,v];syncUI()};
$("resetObject").onclick=()=>{current().pos=[0,0,0];current().rot=[0,0,0];current().scale=[1,1,1];syncUI()};
$("deleteBtn").onclick=()=>{if(objects.length<2)return;objects.splice(selected,1);selected=Math.max(0,selected-1);syncUI()};
$("gridToggle").onclick=()=>{showGrid=!showGrid;$("gridToggle").classList.toggle("active",showGrid)};
$("resetView").onclick=()=>{cameraYaw=.65;cameraPitch=.3;cameraDist=7};
$("fullscreenBtn").onclick=()=>{const el=$("canvasWrap");if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()};
$("sensitivity").oninput=()=>{sensitivity=+$("sensitivity").value;$("sensitivityValue").textContent=sensitivity.toFixed(1)+"×"};
$("modeBtn").onclick=()=>{controlMode=(controlMode+1)%2;$("modeBtn").textContent="Mode: "+(controlMode?"Direct orientation":"Relative rotation");baseline=null};
$("recenterBtn").onclick=()=>{baseline=lastMotionAt?window.latestMotion||null:null;$("motionSub").textContent="Motion reference reset"};
$("addImageBtn").onclick=()=>$("imageInput").click();
function parseOBJ(text){
 const verts=[], faces=[];
 for(const line of text.split(/\r?\n/)){
  const s=line.trim().split(/\s+/); if(!s.length)continue;
  if(s[0]==="v"&&s.length>=4)verts.push([+s[1],+s[2],+s[3]]);
  if(s[0]==="f"&&s.length>=4){
   const ids=s.slice(1).map(x=>parseInt(x.split("/")[0],10)).map(i=>i<0?verts.length+i:i-1);
   for(let i=1;i<ids.length-1;i++)faces.push([ids[0],ids[i],ids[i+1]]);
  }
 }
 const p=[],n=[];
 for(const f of faces){const a=verts[f[0]],b=verts[f[1]],c=verts[f[2]];if(!a||!b||!c)continue;const nn=norm(cross(vsub(b,a),vsub(c,a)));for(const q of [a,b,c]){p.push(...q);n.push(...nn)}}
 if(!p.length)throw new Error("No valid triangle faces found in this OBJ.");
 return normalizeCustom(p,n);
}
function parseSTL(buffer){
 const dv=new DataView(buffer),p=[],n=[];
 const isBinary=buffer.byteLength>=84 && 84+dv.getUint32(80,true)*50===buffer.byteLength;
 if(isBinary){const count=dv.getUint32(80,true);let off=84;for(let i=0;i<count;i++){let nn=[dv.getFloat32(off,true),dv.getFloat32(off+4,true),dv.getFloat32(off+8,true)];off+=12;for(let j=0;j<3;j++){p.push(dv.getFloat32(off,true),dv.getFloat32(off+4,true),dv.getFloat32(off+8,true));n.push(...nn);off+=12}off+=2}}
 else {const text=new TextDecoder().decode(buffer);const re=/facet\s+normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)[\s\S]*?outer\s+loop([\s\S]*?)endloop/gi;let m;while((m=re.exec(text))){const nn=[+m[1],+m[2],+m[3]],vs=[...m[4].matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/gi)];for(const v of vs){p.push(+v[1],+v[2],+v[3]);n.push(...nn)}}}
 if(!p.length)throw new Error("Could not parse this STL file.");
 return normalizeCustom(p,n);
}
function normalizeCustom(p,n){
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[i+j]);max[j]=Math.max(max[j],p[i+j])}
 const center=min.map((v,i)=>(v+max[i])/2),extent=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2],.0001),factor=2/extent;
 for(let i=0;i<p.length;i+=3)for(let j=0;j<3;j++)p[i+j]=(p[i+j]-center[j])*factor;
 return {p:new Float32Array(p),n:new Float32Array(n),uv:new Float32Array(p.length/3*2),count:p.length/3};
}
$("imageInput").onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 const ext=f.name.toLowerCase().split(".").pop();
 if(!["obj","stl"].includes(ext)){alert("Only 3D model files are supported: .OBJ and .STL. Photos are not accepted.");e.target.value="";return}
 if(f.size>15*1024*1024){alert("Choose a 3D model smaller than 15 MB.");e.target.value="";return}
 try{
  const buffer=await f.arrayBuffer();
  const custom=ext==="obj"?parseOBJ(new TextDecoder().decode(buffer)):parseSTL(buffer);
  const previous=current(),o=obj("uploaded");
  o.shape="uploaded";o.name=f.name.slice(0,40);o.customGeometry=custom;o.pos=[...previous.pos];o.rot=[...previous.rot];o.scale=[...previous.scale];o.color=previous.color;o.metal=previous.metal;o.rough=previous.rough;
  objects[selected]=o;
  syncUI();
 }catch(err){alert("Could not load this 3D model: "+err.message)}
 e.target.value="";
};
canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,yaw:cameraYaw,pitch:cameraPitch};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!drag)return;cameraYaw=drag.yaw-(e.clientX-drag.x)*.008;cameraPitch=Math.max(-1.35,Math.min(1.35,drag.pitch+(e.clientY-drag.y)*.008))});
canvas.addEventListener("pointerup",()=>drag=null);canvas.addEventListener("pointercancel",()=>drag=null);
canvas.addEventListener("wheel",e=>{cameraDist=Math.max(2.8,Math.min(16,cameraDist+e.deltaY*.008));e.preventDefault()},{passive:false});
window.addEventListener("resize",()=>{});
function updateMotion(m){window.latestMotion=m;lastMotionAt=Date.now();if(!phoneConnected)return;let o=current();if(!baseline){baseline={...m};return}let a=(m.alpha-baseline.alpha),b=(m.beta-baseline.beta),g=(m.gamma-baseline.gamma);a=((a+540)%360)-180;b=((b+540)%360)-180;g=((g+540)%360)-180;if(controlMode===0){o.rot[1]+=(a*Math.PI/180)*.12*sensitivity;o.rot[0]+=(b*Math.PI/180)*.12*sensitivity;o.rot[2]+=(g*Math.PI/180)*.12*sensitivity;baseline={...m}}else{o.rot[1]=a*Math.PI/180*sensitivity;o.rot[0]=b*Math.PI/180*sensitivity;o.rot[2]=g*Math.PI/180*sensitivity}syncUI()}
async function poll(){if(!sessionToken)return;try{let r=await fetch("/api/status?token="+encodeURIComponent(sessionToken)),d=await r.json();if(!d.valid){$("pairStatus").textContent="Session expired. Reconnect to create a new session.";return}if(d.phone!==phoneConnected){phoneConnected=d.phone;$("pairStatus").textContent=phoneConnected?"Phone connected — motion link ready":"Waiting for phone…";$("motionStatus").textContent=phoneConnected?"Phone connected":"Phone not connected";$("motionSub").textContent=phoneConnected?"Live session active":"Pair a device to begin";document.querySelector(".motion-card .status-dot").classList.toggle("connected",phoneConnected)}if(d.motion&&d.motion.at!==lastServerMotionAt){lastServerMotionAt=d.motion.at;updateMotion(d.motion)}}catch(e){$("pairStatus").textContent="Connection check failed"}} 
$("pairBtn").onclick=async()=>{ $("modal").classList.remove("hidden");$("pairUrl").textContent="Creating session…";$("qrBox").innerHTML='<div class="qr-placeholder">▦</div>';try{let r=await fetch("/api/session");let d=await r.json();sessionToken=d.token;let hostForPhone=d.lan_ip||location.hostname;
let phoneOrigin=location.protocol+"//"+hostForPhone+":"+d.port;
let url=phoneOrigin+"/phone?token="+encodeURIComponent(sessionToken);$("pairUrl").textContent=url;$("copyUrl").onclick=async()=>{try{await navigator.clipboard.writeText(url);$("copyUrl").textContent="Copied!";setTimeout(()=>$("copyUrl").textContent="Copy controller link",1500)}catch(e){prompt("Copy this controller URL",url)}};/* Online QR image is optional; copyable URL remains available offline. */let im=new Image();im.alt="QR code for phone pairing";im.referrerPolicy="no-referrer";im.onload=()=>{$("qrBox").replaceChildren(im)};im.onerror=()=>{$("qrBox").innerHTML='<div class="qr-placeholder">▦</div><small style="font:8px monospace;color:#222">COPY LINK BELOW</small>'};im.src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data="+encodeURIComponent(url);if(sessionPoll)clearInterval(sessionPoll);sessionPoll=setInterval(poll,700)}catch(e){$("pairUrl").textContent="Could not create session. Is the Python server running?"}};
$("closeModal").onclick=()=>$("modal").classList.add("hidden");$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});
$("saveBtn").onclick=()=>{let data={app:"MOTION 3D",version:1,objects:objects.map(o=>({id:o.id,shape:o.shape,name:o.name,pos:o.pos,rot:o.rot,scale:o.scale,color:o.color,metal:o.metal,rough:o.rough,visible:o.visible})),camera:{yaw:cameraYaw,pitch:cameraPitch,distance:cameraDist}};let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="motion-3d-scene.json";a.click();URL.revokeObjectURL(a.href)};
syncUI();
})();