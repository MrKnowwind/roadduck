export const BOARD_COLS = 7;
export const BOARD_ROWS = 12;

const MECHANICS = [
  {
    key: 'speed-up', icon: '⚡', title: '车流提速',
    description: '所有车辆速度提升 16%，观察车距再行动。',
  },
  {
    key: 'turbo-cars', icon: '🏎️', title: '冲刺快车',
    description: '闪电车仅在前方安全距离充足时冲刺，接近普通车会自动减速。',
  },
  {
    key: 'night', icon: '🌙', title: '夜幕降临',
    description: '圆形视野外几乎不可见，车辆会亮起定位车灯。',
  },
  {
    key: 'barriers', icon: '🚧', title: '施工路障',
    description: '草地出现施工锥，绕开被封住的格子。',
  },
  {
    key: 'reverse-lanes', icon: '🔄', title: '逆向车道',
    description: '两条车道改变行驶方向，重新判断来车方向。',
  },
  {
    key: 'city-alert', icon: '🚨', title: '全城警报',
    description: '警报期间全体车辆间歇爆发加速，保持耐心。',
  },
];

export function getMechanic(round) {
  if (round <= MECHANICS.length) return MECHANICS[Math.max(0, round - 1)];
  const bonus = Math.min(20, round);
  return {
    key: `extreme-${round}`,
    icon: '🔥',
    title: `极限叠加 · ${round}`,
    description: `所有既有机制保留，车流速度再提升 ${bonus}%。`,
  };
}

export function wrapMechanicDescription(description, lineLength = 17) {
  return description.split('\n').map((paragraph) => {
    const characters = Array.from(paragraph);
    const lines = [];
    for (let index = 0; index < characters.length; index += lineLength) {
      lines.push(characters.slice(index, index + lineLength).join(''));
    }
    return lines.join('\n');
  }).join('\n');
}

export function canTurboBoost(x, otherVehicleXs, direction, trackLength, safeDistance) {
  return otherVehicleXs.every((otherX) => {
    const rawDistance = direction > 0 ? otherX - x : x - otherX;
    const forwardDistance = ((rawDistance % trackLength) + trackLength) % trackLength;
    return forwardDistance >= safeDistance;
  });
}

export function getNightModeConfig() {
  return {
    radius: 130,
    darkness: 0.94,
    sliceWidth: 10,
    headlights: true,
  };
}

export function movePlayer(position, dx, dy) {
  return {
    col: Math.max(0, Math.min(BOARD_COLS - 1, position.col + dx)),
    row: Math.max(0, Math.min(BOARD_ROWS - 1, position.row + dy)),
  };
}

export function isHit(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}
