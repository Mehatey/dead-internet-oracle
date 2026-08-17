import type { Category, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEFAULT_GESTURE, type Gesture } from './types';

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const d=(a:NormalizedLandmark,b:NormalizedLandmark)=>Math.hypot(a.x-b.x,a.y-b.y);

export class HandTracker {
  private handLandmarker: HandLandmarker|null=null; private stream:MediaStream|null=null; private raf=0; private last=-1;
  private state:Gesture={...DEFAULT_GESTURE}; private prev={x:.5,y:.5,t:performance.now()};
  readonly video=document.createElement('video');
  constructor(private update:(g:Gesture,landmarks:NormalizedLandmark[][])=>void){this.video.autoplay=true;this.video.muted=true;this.video.playsInline=true;}
  async start(){
    const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');
    const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    this.handLandmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.45,minTrackingConfidence:.45});
    this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false});
    this.video.srcObject=this.stream;await this.video.play();this.detect();
  }
  private measure(hand:NormalizedLandmark[],dt:number){
    const palm=Math.max(.035,d(hand[0],hand[9])); const x=1-hand[8].x,y=1-hand[8].y;
    const pinch=1-clamp((d(hand[4],hand[8])/palm-.13)/.82);
    const openness=clamp(([8,12,16,20].reduce((s,i)=>s+d(hand[0],hand[i])/palm,0)/4-1.3)/1.25);
    return{x,y,pinch,openness,velocity:clamp(Math.hypot(x-this.prev.x,y-this.prev.y)/dt/2.2)};
  }
  private detect=()=>{
    if(!this.handLandmarker)return;
    if(this.video.readyState>=2&&this.video.currentTime!==this.last){
      this.last=this.video.currentTime;const result=this.handLandmarker.detectForVideo(this.video,performance.now());
      const now=performance.now(),dt=Math.max(.016,(now-this.prev.t)/1000);const primary=result.landmarks[0];
      if(primary){const p=this.measure(primary,dt),e=.28,second=result.landmarks[1];this.state={x:this.state.x+(p.x-this.state.x)*e,y:this.state.y+(p.y-this.state.y)*e,pinch:this.state.pinch+(p.pinch-this.state.pinch)*.32,openness:this.state.openness+(p.openness-this.state.openness)*e,velocity:this.state.velocity+(p.velocity-this.state.velocity)*.25,hands:result.landmarks.length,handDistance:second?clamp(d(primary[9],second[9])*1.8):0,secondX:second?1-second[8].x:.5,secondY:second?1-second[8].y:.5};this.prev={x:p.x,y:p.y,t:now};}
      else{this.state.hands=0;this.state.velocity*=.8;this.state.pinch*=.8;}
      this.update({...this.state},result.landmarks);
    }
    this.raf=requestAnimationFrame(this.detect);
  };
}
