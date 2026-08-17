export type Gesture = {
  x: number; y: number; velocity: number; pinch: number; openness: number;
  hands: number; handDistance: number; secondX: number; secondY: number;
};
export const DEFAULT_GESTURE: Gesture = { x:.5,y:.5,velocity:0,pinch:0,openness:.7,hands:0,handDistance:0,secondX:.5,secondY:.5 };
