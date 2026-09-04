import * as Phaser from 'phaser';
import {
  BOARD_COLS, BOARD_ROWS, canTurboBoost, getMechanic, isHit, movePlayer,
  getNightModeConfig, wrapMechanicDescription,
} from './gameLogic.js';

const WIDTH = 420;
const HEIGHT = 720;
const CELL = 60;
const ROAD_ROWS = new Set([2, 3, 5, 6, 8, 9]);
const LANES = [
  { row: 2, direction: 1, speed: 92, color: 0xff625f },
  { row: 3, direction: -1, speed: 128, color: 0x54c8ff },
  { row: 5, direction: 1, speed: 145, color: 0xffc857 },
  { row: 6, direction: -1, speed: 106, color: 0xb784f7 },
  { row: 8, direction: 1, speed: 122, color: 0x58db8b },
  { row: 9, direction: -1, speed: 158, color: 0xff8b4c },
];

class CrossRoadScene extends Phaser.Scene {
  constructor() {
    super('cross-road');
  }

  create() {
    this.score = 0;
    this.best = Number(localStorage.getItem('cross-road-best') || 0);
    this.speedMultiplier = 1;
    this.gameOver = false;
    this.mechanicPaused = false;
    this.moving = false;
    this.cars = [];
    this.barriers = [];
    this.fogParts = [];
    this.nightMode = getNightModeConfig();
    this.drawWorld();
    this.createCars();
    this.createPlayer();
    this.createHud();
    this.bindInput();
    if (!this.registry.get('tutorialShown')) {
      this.registry.set('tutorialShown', true);
      this.showMechanicCard({
        icon: '🐥',
        title: '基本操作',
        description: '避开车辆抵达顶部终点。方向键、WASD、滑动或右下按钮均可移动。',
      });
    }
  }

  drawWorld() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x5fac61);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      const y = row * CELL + CELL / 2;
      if (ROAD_ROWS.has(row)) {
        this.add.rectangle(WIDTH / 2, y, WIDTH, CELL, 0x303a3f);
        this.add.rectangle(WIDTH / 2, y, WIDTH, 2, 0x738087, 0.35);
        for (let x = 18; x < WIDTH; x += 48) {
          this.add.rectangle(x, y, 25, 3, 0xf4e7ad, 0.75);
        }
      } else {
        this.add.rectangle(WIDTH / 2, y, WIDTH, CELL, row % 2 ? 0x6cbd68 : 0x73c96e);
        for (let x = 15; x < WIDTH; x += 42) {
          this.add.circle(x + (row % 2) * 15, y + 17, 2, 0x4a9d50, 0.65);
        }
      }
    }

    this.add.rectangle(WIDTH / 2, 4, WIDTH, 8, 0xffdc5e);
    this.add.text(WIDTH / 2, 17, '🏁  终点', {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#15351f',
    }).setOrigin(0.5);
  }

  createCars() {
    LANES.forEach((lane, laneIndex) => {
      const count = 2;
      for (let index = 0; index < count; index += 1) {
        const spacing = WIDTH / count;
        const x = spacing * index + spacing / 2 + (laneIndex % 2) * 30;
        const car = this.makeCar(x, lane.row * CELL + CELL / 2, lane.color, lane.direction);
        car.speed = lane.speed;
        car.direction = lane.direction;
        car.laneIndex = laneIndex;
        car.isTurbo = (laneIndex === 1 || laneIndex === 4) && index === 0;
        car.turboIcon = this.add.text(0, -25, '⚡', {
          fontFamily: 'sans-serif', fontSize: '16px', color: '#fff16b',
        }).setOrigin(0.5).setVisible(false);
        car.add(car.turboIcon);
        car.headlights = this.makeHeadlights().setVisible(false);
        this.cars.push(car);
      }
    });
  }

  makeCar(x, y, color, direction) {
    const car = this.add.container(x, y);
    const body = this.add.rectangle(0, 0, 72, 34, color).setStrokeStyle(2, 0x172126, 0.8);
    const hood = this.add.rectangle(direction * 19, 0, 24, 26, 0xffffff, 0.22);
    const window = this.add.rectangle(-direction * 9, 0, 18, 23, 0xbfe9f5, 0.9);
    const wheelA = this.add.rectangle(-20, -18, 14, 5, 0x11191c);
    const wheelB = this.add.rectangle(20, 18, 14, 5, 0x11191c);
    car.add([wheelA, wheelB, body, hood, window]);
    car.setSize(72, 34);
    return car;
  }

  makeHeadlights() {
    const lights = this.add.container(0, 0).setDepth(15);
    const glowA = this.add.circle(0, -7, 8, 0xffe790, 0.22);
    const glowB = this.add.circle(0, 7, 8, 0xffe790, 0.22);
    const lampA = this.add.circle(0, -7, 3, 0xfff4bd, 1);
    const lampB = this.add.circle(0, 7, 3, 0xfff4bd, 1);
    lights.add([glowA, glowB, lampA, lampB]);
    return lights;
  }

  createPlayer() {
    this.position = { col: 3, row: BOARD_ROWS - 1 };
    this.player = this.add.container(this.cellX(this.position.col), this.cellY(this.position.row));
    const shadow = this.add.ellipse(0, 15, 33, 11, 0x183529, 0.35);
    const body = this.add.circle(0, 2, 17, 0xffe06a).setStrokeStyle(3, 0x24352b);
    const eyeA = this.add.circle(-6, -2, 2, 0x172126);
    const eyeB = this.add.circle(6, -2, 2, 0x172126);
    const beak = this.add.triangle(0, 5, -4, 0, 4, 0, 0, 7, 0xf2913d);
    this.player.add([shadow, body, eyeA, eyeB, beak]);
    this.player.setSize(34, 34);
    this.player.setDepth(10);
  }

  createHud() {
    this.add.rectangle(WIDTH / 2, 43, WIDTH - 24, 58, 0x10251c, 0.9)
      .setStrokeStyle(1, 0xffffff, 0.12).setDepth(20);
    this.scoreText = this.add.text(26, 34, '过街  0', {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(21);
    this.bestText = this.add.text(WIDTH - 26, 34, `最佳  ${this.best}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#c9eed7',
    }).setOrigin(1, 0.5).setDepth(21);
    this.mechanicText = this.add.text(WIDTH / 2, 57, '阶段 1 · 基础车流', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ffdf68',
    }).setOrigin(0.5).setDepth(21);
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      cursorUp: 'UP', cursorDown: 'DOWN', cursorLeft: 'LEFT', cursorRight: 'RIGHT',
    });

    Object.values(this.keys).forEach((key) => key.on('down', () => this.handleKeys(key)));
    this.moveListener = (event) => this.tryMove(event.detail.dx, event.detail.dy);
    window.addEventListener('cross-road-move', this.moveListener);

    let start = null;
    this.input.on('pointerdown', (pointer) => { start = { x: pointer.x, y: pointer.y }; });
    this.input.on('pointerup', (pointer) => {
      if (!start) return;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) this.tryMove(Math.sign(dx), 0);
      else this.tryMove(0, Math.sign(dy));
    });
    this.events.once('shutdown', () => window.removeEventListener('cross-road-move', this.moveListener));
  }

  handleKeys(key) {
    if (key === this.keys.up || key === this.keys.cursorUp) this.tryMove(0, -1);
    if (key === this.keys.down || key === this.keys.cursorDown) this.tryMove(0, 1);
    if (key === this.keys.left || key === this.keys.cursorLeft) this.tryMove(-1, 0);
    if (key === this.keys.right || key === this.keys.cursorRight) this.tryMove(1, 0);
  }

  tryMove(dx, dy) {
    if (this.mechanicPaused) {
      this.dismissMechanicCard();
      return;
    }
    if (this.gameOver) {
      this.scene.restart();
      return;
    }
    if (this.moving) return;

    const next = movePlayer(this.position, dx, dy);
    if (next.col === this.position.col && next.row === this.position.row) return;
    if (this.barriers.some((barrier) => barrier.col === next.col && barrier.row === next.row)) {
      this.cameras.main.shake(70, 0.002);
      return;
    }
    this.position = next;
    this.moving = true;
    this.tweens.add({
      targets: this.player,
      x: this.cellX(next.col),
      y: this.cellY(next.row),
      duration: 105,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.moving = false;
        if (this.position.row === 0) this.completeCrossing();
      },
    });
  }

  completeCrossing() {
    this.score += 1;
    this.best = Math.max(this.best, this.score);
    localStorage.setItem('cross-road-best', String(this.best));
    this.scoreText.setText(`过街  ${this.score}`);
    this.bestText.setText(`最佳  ${this.best}`);
    this.cameras.main.flash(180, 255, 224, 94, false);
    this.position = { col: 3, row: BOARD_ROWS - 1 };
    this.player.setPosition(this.cellX(this.position.col), this.cellY(this.position.row));
    const mechanic = getMechanic(this.score);
    this.applyMechanic(this.score);
    this.mechanicText.setText(`阶段 ${this.score + 1} · ${mechanic.title}`);
    this.showMechanicCard(mechanic);
  }

  applyMechanic(round) {
    if (round === 1) this.speedMultiplier = 1.16;
    if (round === 2) {
      this.cars.filter((car) => car.isTurbo).forEach((car) => car.turboIcon.setVisible(true));
    }
    if (round === 3) {
      this.createFog();
      if (this.nightMode.headlights) {
        this.cars.forEach((car) => car.headlights.setVisible(true));
      }
    }
    if (round === 4) this.createBarriers();
    if (round === 5) {
      this.cars.filter((car) => car.laneIndex === 0 || car.laneIndex === 4)
        .forEach((car) => { car.direction *= -1; });
    }
    if (round > 6) this.speedMultiplier *= 1 + Math.min(20, round) / 100;
  }

  createFog() {
    const { sliceWidth, darkness } = this.nightMode;
    for (let x = sliceWidth / 2; x < WIDTH; x += sliceWidth) {
      const top = this.add.rectangle(x, 0, sliceWidth, 1, 0x020805, darkness).setDepth(14);
      const bottom = this.add.rectangle(x, HEIGHT, sliceWidth, 1, 0x020805, darkness).setDepth(14);
      this.fogParts.push({ x, top, bottom });
    }
  }

  updateFog() {
    if (!this.fogParts.length) return;
    const { radius, sliceWidth } = this.nightMode;
    this.fogParts.forEach((part) => {
      const distanceX = part.x - this.player.x;
      if (Math.abs(distanceX) >= radius) {
        this.setFogSegment(part.top, part.x, HEIGHT / 2, sliceWidth, HEIGHT);
        part.bottom.setVisible(false);
        return;
      }

      const distanceY = Math.sqrt(radius ** 2 - distanceX ** 2);
      const circleTop = Math.max(0, this.player.y - distanceY);
      const circleBottom = Math.min(HEIGHT, this.player.y + distanceY);
      this.setFogSegment(part.top, part.x, circleTop / 2, sliceWidth, circleTop);
      this.setFogSegment(
        part.bottom,
        part.x,
        circleBottom + (HEIGHT - circleBottom) / 2,
        sliceWidth,
        HEIGHT - circleBottom,
      );
    });
  }

  setFogSegment(segment, x, y, width, height) {
    if (height <= 0) {
      segment.setVisible(false);
      return;
    }
    segment.setVisible(true).setPosition(x, y).setDisplaySize(width, height);
  }

  createBarriers() {
    [{ col: 1, row: 4 }, { col: 4, row: 7 }, { col: 2, row: 10 }].forEach((spot) => {
      const marker = this.makeConstructionBarrier(
        this.cellX(spot.col),
        this.cellY(spot.row),
      );
      this.barriers.push({ ...spot, marker });
    });
  }

  makeConstructionBarrier(x, y) {
    const marker = this.add.container(x, y).setDepth(9);
    const shadow = this.add.ellipse(0, 17, 54, 11, 0x153a28, 0.3);
    const postLeft = this.add.rectangle(-18, 3, 5, 29, 0x703d25)
      .setStrokeStyle(1, 0x2c241f, 0.75);
    const postRight = this.add.rectangle(18, 3, 5, 29, 0x703d25)
      .setStrokeStyle(1, 0x2c241f, 0.75);
    const footLeft = this.add.rectangle(-18, 16, 18, 5, 0x3b3029).setStrokeStyle(1, 0x171817);
    const footRight = this.add.rectangle(18, 16, 18, 5, 0x3b3029).setStrokeStyle(1, 0x171817);
    const board = this.add.rectangle(0, -4, 50, 17, 0xf47b34)
      .setStrokeStyle(2, 0x5b321f, 1);
    const stripeLeft = this.add.polygon(0, 0, [
      -21, -12, -13, -12, -6, 4, -14, 4,
    ], 0xfff2d4);
    const stripeMiddle = this.add.polygon(0, 0, [
      -5, -12, 3, -12, 10, 4, 2, 4,
    ], 0xfff2d4);
    const stripeRight = this.add.polygon(0, 0, [
      11, -12, 19, -12, 23, -3, 23, 4, 18, 4,
    ], 0xfff2d4);
    const lightGlow = this.add.circle(0, -18, 7, 0xffc43d, 0.22);
    const lightBase = this.add.rectangle(0, -14, 9, 4, 0x3b3029);
    const warningLight = this.add.circle(0, -19, 3.5, 0xffd75a)
      .setStrokeStyle(1, 0xfff1ad, 0.9);
    const cone = this.add.triangle(23, 7, -6, 9, 6, 9, 0, -9, 0xef6c2f)
      .setStrokeStyle(1.5, 0xfff2d4, 1);
    const coneBase = this.add.rectangle(23, 15, 17, 4, 0x45342b);

    marker.add([
      shadow,
      postLeft,
      postRight,
      footLeft,
      footRight,
      board,
      stripeLeft,
      stripeMiddle,
      stripeRight,
      lightGlow,
      lightBase,
      warningLight,
      coneBase,
      cone,
    ]);
    this.tweens.add({
      targets: [lightGlow, warningLight],
      alpha: { from: 0.25, to: 1 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
    return marker;
  }

  showMechanicCard(mechanic) {
    this.mechanicPaused = true;
    const overlay = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x06100c, 0.76)
      .setOrigin(0).setInteractive();
    const card = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 54, 250, 0x183b2c, 1)
      .setStrokeStyle(3, 0xffdc5e, 0.9);
    const cardLabel = this.score === 0 ? '新手说明 · 基础机制' : `第 ${this.score} 次过街 · 新机制`;
    const eyebrow = this.add.text(WIDTH / 2, HEIGHT / 2 - 90, cardLabel, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffdf68',
    }).setOrigin(0.5);
    const icon = this.add.text(WIDTH / 2, HEIGHT / 2 - 48, mechanic.icon, {
      fontFamily: 'sans-serif', fontSize: '40px',
    }).setOrigin(0.5);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 + 1, mechanic.title, {
      fontFamily: 'sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    const description = this.add.text(
      WIDTH / 2,
      HEIGHT / 2 + 49,
      wrapMechanicDescription(mechanic.description),
      {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#d8f2e1', align: 'center',
      wordWrap: { width: WIDTH - 105 }, lineSpacing: 5,
      },
    ).setOrigin(0.5);
    const continueText = this.add.text(WIDTH / 2, HEIGHT / 2 + 97, '点击屏幕继续', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ffdf68',
    }).setOrigin(0.5);
    this.mechanicCard = this.add.container(0, 0, [overlay, card, eyebrow, icon, title, description, continueText])
      .setDepth(40);
    overlay.once('pointerdown', () => this.dismissMechanicCard());
  }

  dismissMechanicCard() {
    if (!this.mechanicPaused) return;
    this.mechanicPaused = false;
    this.mechanicCard?.destroy(true);
    this.mechanicCard = null;
  }

  update(time, delta) {
    if (this.gameOver || this.mechanicPaused) return;
    const seconds = delta / 1000;

    this.cars.forEach((car) => {
      const laneVehicleXs = this.cars
        .filter((other) => other !== car && other.laneIndex === car.laneIndex)
        .map((other) => other.x);
      const turboWindow = this.score >= 2 && car.isTurbo && Math.floor(time / 850) % 5 === 0;
      const hasSafeGap = canTurboBoost(
        car.x,
        laneVehicleXs,
        car.direction,
        WIDTH + 100,
        130,
      );
      const turbo = turboWindow && hasSafeGap ? 2.15 : 1;
      const alert = this.score >= 6 && Math.floor(time / 650) % 7 === 0 ? 1.65 : 1;
      car.x += car.speed * car.direction * this.speedMultiplier * turbo * alert * seconds;
      if (car.turboIcon.visible) car.turboIcon.setAlpha(turbo > 1 ? 1 : 0.38);
      if (car.direction > 0 && car.x > WIDTH + 50) car.x = -50;
      if (car.direction < 0 && car.x < -50) car.x = WIDTH + 50;
      car.headlights.setPosition(car.x + car.direction * 29, car.y);

      if (isHit(
        { x: this.player.x, y: this.player.y, width: 28, height: 28 },
        { x: car.x, y: car.y, width: 66, height: 28 },
      )) this.endGame();
    });
    this.updateFog();
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.cameras.main.shake(220, 0.012);
    this.player.setAlpha(0.3);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07110d, 0.64).setDepth(30);
    this.add.text(WIDTH / 2, HEIGHT / 2 - 44, '撞车啦！', {
      fontFamily: 'sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(31);
    this.add.text(WIDTH / 2, HEIGHT / 2 + 8, `成功过街 ${this.score} 次`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#c9eed7',
    }).setOrigin(0.5).setDepth(31);
    this.add.text(WIDTH / 2, HEIGHT / 2 + 60, '点击或按方向键重新开始', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffdf68',
    }).setOrigin(0.5).setDepth(31);
    this.input.once('pointerdown', () => this.scene.restart());
  }

  cellX(col) { return col * CELL + CELL / 2; }
  cellY(row) { return row * CELL + CELL / 2; }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#5fac61',
  scene: CrossRoadScene,
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});

document.querySelectorAll('.control').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('cross-road-move', {
      detail: { dx: Number(button.dataset.dx), dy: Number(button.dataset.dy) },
    }));
  });
});
