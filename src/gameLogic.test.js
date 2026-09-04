import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTurboBoost, getMechanic, getNightModeConfig, isHit, movePlayer,
  wrapMechanicDescription,
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

test('每次过街都会获得对应的新机制说明', () => {
  assert.deepEqual(getMechanic(1), {
    key: 'speed-up',
    icon: '⚡',
    title: '车流提速',
    description: '所有车辆速度提升 16%，观察车距再行动。',
  });
  assert.equal(getMechanic(6).key, 'city-alert');
  assert.equal(getMechanic(8).key, 'extreme-8');
  assert.match(getMechanic(8).description, /8%/);
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
