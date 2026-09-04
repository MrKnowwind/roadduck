import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTurboBoost, getBoardRows, getMechanicsForRound, getNightModeConfig, getRoadRows,
  getTransitionTimings, getVehicleCount, getVehicleWave, isFrontalCollision,
  isHit, movePlayer, swipeDirection, wrapMechanicDescription,
} from './gameLogic.js';

test('玩家只能在棋盘内按格移动', () => {
  assert.deepEqual(movePlayer({ col: 3, row: 7 }, 0, -1), { col: 3, row: 6 });
  assert.deepEqual(movePlayer({ col: 0, row: 0 }, -1, -1), { col: 0, row: 0 });
  assert.deepEqual(movePlayer({ col: 6, row: 11 }, 1, 1), { col: 6, row: 11 });
});

test('车辆与玩家占用同一区域时判定碰撞', () => {
  const player = { x: 100, y: 100, width: 34, height: 34 };
  assert.equal(isHit(player, { x: 120, y: 100, width: 70, height: 30 }), true);
  assert.equal(isHit(player, { x: 160, y: 100, width: 70, height: 30 }), false);
});

test('前七关每关只启用一个机制', () => {
  assert.deepEqual(getMechanicsForRound(1).map((item) => item.key), ['speed-up']);
  assert.deepEqual(getMechanicsForRound(6).map((item) => item.key), ['city-alert']);
  assert.equal(getMechanicsForRound(7).length, 1);
});

test('第八关起随机选择越来越多且不重复的复合机制', () => {
  const randomValues = [0.9, 0.1, 0.7, 0.2, 0.6, 0.3];
  let index = 0;
  const random = () => randomValues[index++ % randomValues.length];
  const round8 = getMechanicsForRound(8, random);
  index = 0;
  const round14 = getMechanicsForRound(14, random);
  assert.equal(round8.length, 2);
  assert.equal(round14.length, 4);
  assert.equal(new Set(round14.map((item) => item.key)).size, round14.length);
});

test('关卡推进会增加道路总数并出现连续五车道', () => {
  assert.ok(getRoadRows(1).length < getRoadRows(7).length);
  const lateRoads = getRoadRows(7);
  assert.ok([1, 2, 3, 4, 5].every((row) => lateRoads.includes(row)));
});

test('后期关卡地图高度超过一屏且玩家可在完整地图内移动', () => {
  assert.equal(getBoardRows(1), 12);
  assert.equal(getBoardRows(7), 18);
  assert.ok(getRoadRows(7).some((row) => row > 10));
  assert.deepEqual(movePlayer({ col: 3, row: 17 }, 0, 1, 18), { col: 3, row: 17 });
  assert.deepEqual(movePlayer({ col: 3, row: 17 }, 0, -1, 18), { col: 3, row: 16 });
});

test('每条车道每次生成一到四辆车', () => {
  assert.equal(getVehicleCount(() => 0), 1);
  assert.equal(getVehicleCount(() => 0.25), 2);
  assert.equal(getVehicleCount(() => 0.5), 3);
  assert.equal(getVehicleCount(() => 0.999), 4);
});

test('同一车道每一波都会重新随机车辆数量、间隔和停顿', () => {
  assert.deepEqual(getVehicleWave(1, () => 0), { count: 1, gap: 88, pause: 300 });
  assert.deepEqual(getVehicleWave(1, () => 0.999), { count: 4, gap: 148, pause: 900 });
  assert.deepEqual(getVehicleWave(13, () => 0), { count: 1, gap: 88, pause: 40 });
  assert.deepEqual(getVehicleWave(13, () => 0.999), { count: 4, gap: 148, pause: 240 });
});

test('只有车头方向的碰撞致命，车身侧面碰撞会被弹回', () => {
  assert.equal(isFrontalCollision(130, 100, 1), true);
  assert.equal(isFrontalCollision(70, 100, 1), false);
  assert.equal(isFrontalCollision(70, 100, -1), true);
  assert.equal(isFrontalCollision(105, 100, 1), false);
});

test('结算界面要等过关或死亡动画完整播放后出现', () => {
  const timings = getTransitionTimings();
  assert.ok(timings.nextRoundDelay >= 900);
  assert.ok(timings.gameOverOverlayDelay >= 800);
});

test('滑动方向选择位移更明显的轴并可随手势改向', () => {
  assert.deepEqual(swipeDirection(3, -20), { dx: 0, dy: -1 });
  assert.deepEqual(swipeDirection(18, -4), { dx: 1, dy: 0 });
});

test('中文机制说明会按卡片宽度主动换行', () => {
  assert.equal(wrapMechanicDescription('一二三四五六七八九十', 4), '一二三四\n五六七八\n九十');
});

test('冲刺车只有在前方安全距离足够时才允许加速', () => {
  assert.equal(canTurboBoost(100, [190], 1, 520, 120), false);
  assert.equal(canTurboBoost(100, [260], 1, 520, 120), true);
  assert.equal(canTurboBoost(490, [40], 1, 520, 120), false);
  assert.equal(canTurboBoost(40, [490], -1, 520, 120), false);
});

test('黑夜机制使用更大的圆形视野并显示车辆位置灯', () => {
  assert.deepEqual(getNightModeConfig(), {
    radius: 130,
    darkness: 0.94,
    sliceWidth: 10,
    headlights: true,
  });
});
