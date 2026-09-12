export type HandPoseName = 'OPEN' | 'GATHER' | 'CUP' | 'ROLL_LEFT' | 'ROLL_RIGHT' | 'HOLD_LOKMA' | 'EAT';
export type HandMotion = { pose: HandPoseName; pulse: number };
export type FingerBend = [number, number, number];
export type HandPose = {
  /** MCP, PIP, DIP bends; ordered pinky, ring, middle, index. */
  fingers: [FingerBend, FingerBend, FingerBend, FingerBend];
  spread: number; thumb: number; cup: number; flip: number;
};

export const HAND_POSES: Record<HandPoseName, HandPose> = {
  OPEN: {
    fingers: [[.16, .25, .12], [.10, .20, .09], [.06, .13, .07], [.08, .16, .08]],
    spread: 1, thumb: 0, cup: .15, flip: 0,
  },
  GATHER: {
    fingers: [[.34, .43, .18], [.28, .38, .16], [.23, .34, .14], [.26, .37, .16]],
    spread: .30, thumb: .25, cup: .40, flip: 2.55,
  },
  CUP: {
    fingers: [[.43, .57, .23], [.37, .52, .20], [.31, .46, .18], [.35, .50, .20]],
    spread: .22, thumb: .42, cup: .75, flip: 0,
  },
  ROLL_LEFT: {
    fingers: [[.64, 1.10, .34], [.59, 1.08, .32], [.51, 1.04, .30], [.56, 1.06, .32]],
    spread: .15, thumb: .85, cup: 1, flip: -.085,
  },
  ROLL_RIGHT: {
    fingers: [[.60, 1.00, .31], [.54, .98, .29], [.47, .94, .27], [.51, .96, .29]],
    spread: .18, thumb: .72, cup: .95, flip: .085,
  },
  HOLD_LOKMA: {
    fingers: [[.59, .73, .27], [.53, .68, .25], [.45, .63, .22], [.49, .66, .24]],
    spread: .20, thumb: .68, cup: .90, flip: 0,
  },
  EAT: {
    fingers: [[.50, .62, .23], [.44, .57, .21], [.37, .51, .18], [.41, .55, .20]],
    spread: .28, thumb: .55, cup: .75, flip: 0,
  },
};

export function copyHandPose(pose: HandPose): HandPose {
  return { ...pose, fingers: pose.fingers.map(bend => [...bend]) as HandPose['fingers'] };
}

export function interpolateHandPose(current: HandPose, target: HandPose, alpha: number) {
  for (let finger = 0; finger < 4; finger++) for (let joint = 0; joint < 3; joint++) {
    current.fingers[finger][joint] += (target.fingers[finger][joint] - current.fingers[finger][joint]) * alpha;
  }
  for (const key of ['spread', 'thumb', 'cup', 'flip'] as const) current[key] += (target[key] - current[key]) * alpha;
}
