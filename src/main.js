import * as Phaser from 'phaser';
import {
  BOARD_COLS, BOARD_ROWS, canTurboBoost, getMechanicsForRound, getNightModeConfig,
  getRoadRows, getTransitionTimings, getVehicleWave, isFrontalCollision, isHit,
  movePlayer, swipeDirection, wrapMechanicDescription,
} from './gameLogic.js';

const WIDTH = 420;
const HEIGHT = 720;
const CELL = 60;
const CAR_COLORS = [0xff625f, 0x54c8ff, 0xffc857, 0xb784f7, 0x58db8b, 0xff8b4c];

class CrossRoadScene extends Phaser.Scene {
  constructor() {
    super('cross-road');
  }

  create(data = {}) {
    this.score = data.score || 0;
    this.round = this.score + 1;
    this.best = Number(localStorage.getItem('cross-road-best') || 0);
    this.speedMultiplier = 1 + Math.min(0.35, this.score * 0.025);
    this.gameOver = false;
    this.canRestart = false;
    this.mechanicPaused = false;
    this.moving = false;
    this.scared = false;
    this.cars = [];
    this.lanes = [];
    this.barriers = [];
    this.fogParts = [];
    this.nightMode = getNightModeConfig();
    this.transitionTimings = getTransitionTimings();
    this.roadRows = new Set(getRoadRows(this.round));
    this.activeMechanics = getMechanicsForRound(this.round);
    this.activeMechanicKeys = new Set(this.activeMechanics.map((item) => item.key));
    this.touchDirection = null;
    this.keyboardDirection = null;
    this.drawWorld();
    this.drawDecorations();
    this.createAmbientMotion();
    this.createCars();
    this.createPlayer();
    this.createHud();
    this.bindInput();
    this.applyMechanics();
    if (this.score > 0) {
      this.showMechanicCard(this.activeMechanics);
    } else if (!this.registry.get('tutorialShown')) {
      this.registry.set('tutorialShown', true);
      this.showMechanicCard({
        ...this.activeMechanics[0],
        title: '基本操作 · 车流提速',
        description: '避开车头抵达顶部终点。碰到车身侧面会受惊退回原格，长按方向键或按住滑动可持续移动。',
      });
    }
  }

  drawWorld() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x76c96f);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      const y = row * CELL + CELL / 2;
      if (this.roadRows.has(row)) {
        this.add.rectangle(WIDTH / 2, y, WIDTH, CELL, 0x3f4a4f);
        this.add.rectangle(WIDTH / 2, y - 27, WIDTH, 6, 0xd7d2bc, 0.24);
        this.add.rectangle(WIDTH / 2, y + 27, WIDTH, 6, 0x202a2e, 0.3);
        for (let x = 18; x < WIDTH; x += 48) {
          this.add.rectangle(x, y + 1, 25, 4, 0xffe7a0, 0.85).setAngle(-1);
        }
        for (let x = 34; x < WIDTH; x += 91) {
          const offset = ((row * 19 + x) % 17) - 8;
          this.add.polygon(x, y + offset, [-8, 1, -3, -2, 7, -1, 10, 2, 1, 3], 0x263237, 0.2);
        }
      } else {
        this.add.rectangle(WIDTH / 2, y, WIDTH, CELL, row % 2 ? 0x78c970 : 0x82d178);
        for (let x = 15; x < WIDTH; x += 42) {
          this.add.ellipse(x + (row % 2) * 15, y + 17, 3, 7, 0x55aa55, 0.7).setAngle(20);
        }
      }
    }

    for (let x = 15; x < WIDTH; x += 30) {
      this.add.rectangle(x, 5, 30, 10, x % 60 === 15 ? 0xfff4d5 : 0x29343a);
    }
    this.add.rectangle(WIDTH / 2, 91, 106, 24, 0xffdb61)
      .setStrokeStyle(3, 0x35553c).setDepth(2);
    this.add.text(WIDTH / 2, 91, '🏁  安全岛', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#27422e',
    }).setOrigin(0.5).setDepth(3);
  }

  drawDecorations() {
    const flowers = [
      [18, 104, 0xffef8c], [390, 108, 0xffa6c5], [96, 278, 0xffffff],
      [338, 287, 0xffef8c], [22, 448, 0xffa6c5], [382, 455, 0xffffff],
      [105, 624, 0xffef8c], [327, 632, 0xffa6c5],
    ];
    flowers.filter(([, y]) => !this.roadRows.has(Math.floor(y / CELL))).forEach(([x, y, color]) => {
      this.add.rectangle(x, y + 5, 2, 9, 0x388e45, 0.8).setAngle(8);
      this.add.ellipse(x - 3, y - 1, 5, 8, color, 0.92).setAngle(-38);
      this.add.ellipse(x + 3, y - 1, 5, 8, color, 0.92).setAngle(38);
      this.add.ellipse(x, y - 4, 5, 8, color, 0.92);
      this.add.circle(x, y, 2, 0xf4a83b);
    });
    [[52, 116], [368, 271], [65, 461], [354, 617]]
      .filter(([, y]) => !this.roadRows.has(Math.floor(y / CELL))).forEach(([x, y]) => {
      const shrub = this.add.container(x, y);
      const shadow = this.add.ellipse(1, 9, 32, 8, 0x2c6f43, 0.2);
      const stem = this.add.rectangle(0, 4, 5, 10, 0x347b48);
      const leafA = this.add.ellipse(-8, 0, 18, 16, 0x429d55).setStrokeStyle(2, 0x347b48);
      const leafB = this.add.ellipse(3, -4, 22, 20, 0x55b965).setStrokeStyle(2, 0x347b48);
      const leafC = this.add.ellipse(11, 1, 15, 14, 0x4cac5e).setStrokeStyle(2, 0x347b48);
      shrub.add([shadow, stem, leafA, leafB, leafC]);
    });
    for (let x = 28; x < WIDTH; x += 57) {
      const y = 82 + ((x * 7) % 570);
      if (!this.roadRows.has(Math.floor(y / CELL))) {
        this.add.polygon(x, y, [-7, 5, -4, -6, 0, 3, 3, -8, 7, 5], 0x398f4c, 0.75);
      }
    }
  }

  createAmbientMotion() {
    const createCloud = (y, scale, duration, delay) => {
      const cloud = this.add.container(-150, y).setDepth(1).setScale(scale);
      const outer = [-72, 9, -67, -7, -53, -14, -43, -29, -23, -34, -9, -25,
        3, -43, 28, -41, 42, -24, 58, -22, 71, -8, 68, 8, 51, 17, 24, 15,
        4, 22, -24, 17, -50, 19];
      const inner = [-52, 7, -47, -8, -31, -13, -19, -27, 1, -29, 15, -19,
        31, -22, 49, -9, 54, 5, 38, 12, 17, 10, -2, 17, -25, 13];
      cloud.add([
        this.add.polygon(5, 6, outer, 0x173f32, 0.07),
        this.add.polygon(0, 0, outer, 0x173f32, 0.12),
        this.add.polygon(10, -2, inner, 0x225644, 0.08),
      ]);
      this.tweens.add({
        targets: cloud,
        x: WIDTH + 150,
        duration,
        delay,
        repeat: -1,
        onRepeat: () => {
          cloud.y = Phaser.Math.Between(95, HEIGHT - 80);
        },
      });
    };
    createCloud(130, 1.05, 11800, 0);
    createCloud(470, 0.72, 15200, 3600);
  }

  createCars() {
    [...this.roadRows].forEach((row, laneIndex) => {
      const lane = {
        row,
        laneIndex,
        direction: laneIndex % 2 === 0 ? 1 : -1,
        speed: 88 + (laneIndex * 19) % 68,
        cars: [],
        nextWaveAt: 0,
      };
      this.lanes.push(lane);
      this.spawnVehicleWave(lane, true);
    });
  }

  spawnVehicleWave(lane, initial = false) {
    const wave = getVehicleWave();
    const leadX = initial
      ? Phaser.Math.Between(35, WIDTH - 35)
      : lane.direction > 0 ? -50 : WIDTH + 50;
    lane.nextWaveAt = Number.POSITIVE_INFINITY;
    lane.pauseAfterWave = wave.pause;
    for (let index = 0; index < wave.count; index += 1) {
      const x = leadX - lane.direction * index * wave.gap;
      const color = CAR_COLORS[(lane.laneIndex + index * 2 + wave.count) % CAR_COLORS.length];
      const car = this.makeCar(x, lane.row * CELL + CELL / 2, color, lane.direction);
      car.speed = lane.speed;
      car.direction = lane.direction;
      car.laneIndex = lane.laneIndex;
      car.lane = lane;
      car.isTurbo = (lane.laneIndex === 1 || lane.laneIndex === 4) && index === 0;
      car.turboIcon = this.add.text(0, -25, '⚡', {
        fontFamily: 'sans-serif', fontSize: '16px', color: '#fff16b',
      }).setOrigin(0.5).setVisible(this.activeMechanicKeys.has('turbo-cars') && car.isTurbo);
      car.add(car.turboIcon);
      car.headlights = this.makeHeadlights()
        .setVisible(this.activeMechanicKeys.has('night') && this.nightMode.headlights);
      lane.cars.push(car);
      this.cars.push(car);
    }
  }

  removeVehicle(car, time) {
    const lane = car.lane;
    car.headlights.destroy();
    car.destroy();
    this.cars = this.cars.filter((candidate) => candidate !== car);
    lane.cars = lane.cars.filter((candidate) => candidate !== car);
    if (lane.cars.length === 0) lane.nextWaveAt = time + lane.pauseAfterWave;
  }

  makeCar(x, y, color, direction) {
    const car = this.add.container(x, y);
    car.setDepth(6);
    const shadow = this.add.ellipse(-2, 5, 75, 33, 0x142126, 0.28);
    const wheelA = this.add.rectangle(-20, -16, 13, 6, 0x172025).setStrokeStyle(1, 0x080d0f);
    const wheelB = this.add.rectangle(20, 16, 13, 6, 0x172025).setStrokeStyle(1, 0x080d0f);
    const wheelC = this.add.rectangle(20, -16, 13, 6, 0x172025).setStrokeStyle(1, 0x080d0f);
    const wheelD = this.add.rectangle(-20, 16, 13, 6, 0x172025).setStrokeStyle(1, 0x080d0f);
    const body = this.add.graphics();
    body.fillStyle(color, 1).fillRoundedRect(-36, -16.5, 72, 33, 9);
    body.lineStyle(3, 0x26353a, 0.95).strokeRoundedRect(-36, -16.5, 72, 33, 9);
    const bumper = this.add.rectangle(direction * 35, 0, 5, 25, 0xf7e7bf, 0.72);
    const cabin = this.add.graphics();
    cabin.fillStyle(0x273941, 1).fillRoundedRect(-direction * 7 - 15.5, -13.5, 31, 27, 7);
    cabin.lineStyle(2, 0xffffff, 0.28).strokeRoundedRect(-direction * 7 - 15.5, -13.5, 31, 27, 7);
    const windshield = this.add.graphics();
    windshield.fillStyle(0xa9e4ec, 0.9)
      .fillRoundedRect(direction * 2 - 4, -10, 8, 20, 2);
    const rearWindow = this.add.graphics();
    rearWindow.fillStyle(0x78bbc8, 0.72)
      .fillRoundedRect(-direction * 15 - 3, -9, 6, 18, 2);
    const highlight = this.add.rectangle(direction * 20, -10, 22, 3, 0xffffff, 0.35);
    const lampA = this.add.circle(direction * 34, -10, 2.5, 0xfff0a5);
    const lampB = this.add.circle(direction * 34, 10, 2.5, 0xfff0a5);
    car.tailLampA = this.add.circle(-direction * 34, -10, 2.5, 0xe8443f);
    car.tailLampB = this.add.circle(-direction * 34, 10, 2.5, 0xe8443f);
    car.visual = this.add.container(0, 0, [
      wheelA, wheelB, wheelC, wheelD, body, bumper, cabin, windshield,
      rearWindow, highlight, lampA, lampB, car.tailLampA, car.tailLampB,
    ]);
    car.add([shadow, car.visual]);
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
    this.playerShadow = this.add.ellipse(0, 16, 36, 12, 0x183529, 0.3);
    const wingLeft = this.add.ellipse(-14, 4, 12, 18, 0xf2bd3e).setAngle(-20);
    const wingRight = this.add.ellipse(14, 4, 12, 18, 0xf2bd3e).setAngle(20);
    const body = this.add.ellipse(0, 4, 34, 37, 0xffd95b).setStrokeStyle(3, 0x5c4728);
    const face = this.add.circle(0, -7, 16, 0xffe877).setStrokeStyle(2, 0x5c4728);
    const shine = this.add.ellipse(-7, -15, 7, 4, 0xffffff, 0.42).setAngle(-18);
    this.eyeA = this.add.ellipse(-6.5, -10, 3.5, 5.5, 0x253027);
    this.eyeB = this.add.ellipse(6.5, -10, 3.5, 5.5, 0x253027);
    const eyeShineA = this.add.circle(-7, -11.5, 0.9, 0xffffff);
    const eyeShineB = this.add.circle(6, -11.5, 0.9, 0xffffff);
    const cheekA = this.add.ellipse(-11, -3, 5, 3, 0xffa45c, 0.38);
    const cheekB = this.add.ellipse(11, -3, 5, 3, 0xffa45c, 0.38);
    const upperBeak = this.add.ellipse(0, -0.5, 14, 6, 0xf5a13f)
      .setStrokeStyle(1.2, 0x87401f);
    const nostrilA = this.add.circle(-2.7, -1.8, 0.65, 0x9c4b25, 0.82);
    const nostrilB = this.add.circle(2.7, -1.8, 0.65, 0x9c4b25, 0.82);
    const footA = this.add.ellipse(-8, 20, 12, 5, 0xe98933);
    const footB = this.add.ellipse(8, 20, 12, 5, 0xe98933);
    this.playerVisual = this.add.container(0, 0, [
      footA, footB, wingLeft, wingRight, body, face, shine,
      this.eyeA, this.eyeB, eyeShineA, eyeShineB, cheekA, cheekB,
      upperBeak, nostrilA, nostrilB,
    ]);
    this.player.add([this.playerShadow, this.playerVisual]);
    this.player.setSize(34, 34);
    this.player.setDepth(10);
    this.idleTween = this.tweens.add({
      targets: this.playerVisual,
      scaleY: 1.035,
      y: -1,
      duration: 760,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.time.addEvent({
      delay: 2200,
      loop: true,
      callback: () => {
        if (this.moving || this.gameOver) return;
        this.tweens.add({ targets: [this.eyeA, this.eyeB], scaleY: 0.08, duration: 70, yoyo: true });
      },
    });
  }

  createHud() {
    this.add.rectangle(WIDTH / 2 + 2, 46, WIDTH - 24, 58, 0x07150f, 0.26).setDepth(19);
    this.add.rectangle(WIDTH / 2, 43, WIDTH - 24, 58, 0x163a2b, 0.96)
      .setStrokeStyle(2, 0xf5dd7c, 0.28).setDepth(20);
    this.add.circle(18, 43, 4, 0xffd85e, 0.8).setDepth(21);
    this.add.circle(WIDTH - 18, 43, 4, 0xffd85e, 0.8).setDepth(21);
    this.scoreText = this.add.text(26, 34, `关卡  ${this.round}`, {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(21);
    this.bestText = this.add.text(WIDTH - 26, 34, `最佳  ${this.best}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#c9eed7',
    }).setOrigin(1, 0.5).setDepth(21);
    const mechanicLabel = this.activeMechanics.length
      ? this.activeMechanics.map((item) => item.title).join(' + ')
      : '基础教学';
    this.mechanicText = this.add.text(WIDTH / 2, 57, mechanicLabel, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ffdf68',
    }).setOrigin(0.5).setDepth(21);
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      cursorUp: 'UP', cursorDown: 'DOWN', cursorLeft: 'LEFT', cursorRight: 'RIGHT',
    });

    Object.values(this.keys).forEach((key) => {
      key.on('down', () => {
        this.keyboardDirection = this.directionForKey(key);
        if (this.mechanicPaused || this.gameOver) {
          this.tryMove(this.keyboardDirection.dx, this.keyboardDirection.dy);
        }
      });
      key.on('up', () => {
        const remaining = Object.values(this.keys).find((candidate) => candidate.isDown);
        this.keyboardDirection = remaining ? this.directionForKey(remaining) : null;
      });
    });

    let touchAnchor = null;
    this.input.on('pointerdown', (pointer) => {
      touchAnchor = { x: pointer.x, y: pointer.y };
      this.touchDirection = null;
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown || !touchAnchor) return;
      const dx = pointer.x - touchAnchor.x;
      const dy = pointer.y - touchAnchor.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      this.touchDirection = swipeDirection(dx, dy);
      touchAnchor = { x: pointer.x, y: pointer.y };
    });
    this.input.on('pointerup', () => {
      touchAnchor = null;
      this.touchDirection = null;
    });
  }

  directionForKey(key) {
    if (key === this.keys.up || key === this.keys.cursorUp) return { dx: 0, dy: -1 };
    if (key === this.keys.down || key === this.keys.cursorDown) return { dx: 0, dy: 1 };
    if (key === this.keys.left || key === this.keys.cursorLeft) return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
  }

  tryMove(dx, dy) {
    if (this.mechanicPaused) {
      this.dismissMechanicCard();
      return;
    }
    if (this.gameOver) {
      if (this.canRestart) this.scene.restart({ score: this.score });
      return;
    }
    if (this.moving) return;

    const next = movePlayer(this.position, dx, dy);
    if (next.col === this.position.col && next.row === this.position.row) return;
    if (this.barriers.some((barrier) => barrier.col === next.col && barrier.row === next.row)) {
      this.cameras.main.shake(70, 0.002);
      return;
    }
    this.moveOrigin = { ...this.position };
    this.position = next;
    this.moving = true;
    this.idleTween.pause();
    this.playerVisual.setAngle(dx * 8);
    this.playerVisual.setScale(1.08, 0.86);
    this.spawnDust(this.player.x, this.player.y + 17, 3);
    this.tweens.add({
      targets: this.player,
      x: this.cellX(next.col),
      y: this.cellY(next.row),
      duration: 155,
      ease: 'Sine.easeInOut',
      onUpdate: (_tween, target) => {
        const arc = Math.sin(_tween.progress * Math.PI);
        this.playerVisual.y = -arc * 13;
        this.playerVisual.setScale(1 - arc * 0.08, 1 + arc * 0.12);
        this.playerShadow.setScale(1 - arc * 0.35, 1 - arc * 0.22);
        this.playerShadow.setAlpha(0.3 - arc * 0.16);
      },
      onComplete: () => {
        this.playerVisual.setPosition(0, 0).setScale(1.12, 0.82);
        this.playerShadow.setScale(1).setAlpha(0.3);
        this.tweens.add({
          targets: this.playerVisual,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          duration: 100,
          ease: 'Back.easeOut',
        });
        this.spawnDust(this.player.x, this.player.y + 17, 4);
        this.moving = false;
        this.idleTween.resume();
        if (this.position.row === 0) this.completeCrossing();
      },
    });
  }

  completeCrossing() {
    this.score += 1;
    this.best = Math.max(this.best, this.score);
    localStorage.setItem('cross-road-best', String(this.best));
    this.scoreText.setText(`完成  ${this.score}`);
    this.bestText.setText(`最佳  ${this.best}`);
    this.tweens.add({
      targets: this.scoreText,
      scale: 1.35,
      duration: 110,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    this.cameras.main.flash(180, 255, 224, 94, false);
    this.spawnCelebration();
    this.mechanicPaused = true;
    this.time.delayedCall(this.transitionTimings.nextRoundDelay, () => {
      this.scene.restart({ score: this.score });
    });
  }

  applyMechanics() {
    if (this.activeMechanicKeys.has('speed-up')) this.speedMultiplier *= 1.16;
    if (this.activeMechanicKeys.has('turbo-cars')) {
      this.cars.filter((car) => car.isTurbo).forEach((car) => car.turboIcon.setVisible(true));
    }
    if (this.activeMechanicKeys.has('night')) {
      this.createFog();
      if (this.nightMode.headlights) {
        this.cars.forEach((car) => car.headlights.setVisible(true));
      }
    }
    if (this.activeMechanicKeys.has('barriers')) this.createBarriers();
    if (this.activeMechanicKeys.has('reverse-lanes')) {
      this.lanes.filter((lane) => lane.laneIndex === 0 || lane.laneIndex === 4)
        .forEach((lane) => { lane.direction *= -1; });
      this.cars.filter((car) => car.laneIndex === 0 || car.laneIndex === 4)
        .forEach((car) => {
          car.direction *= -1;
          car.visual.scaleX *= -1;
        });
    }
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
    const grassRows = Array.from({ length: BOARD_ROWS - 2 }, (_, index) => index + 1)
      .filter((row) => !this.roadRows.has(row));
    grassRows.slice(0, 3).map((row, index) => ({ col: [1, 4, 2][index], row })).forEach((spot) => {
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

  showMechanicCard(mechanics) {
    this.mechanicPaused = true;
    const combined = Array.isArray(mechanics) ? mechanics : [mechanics];
    const titleText = combined.length === 1
      ? combined[0].title
      : `${combined.length} 项复合机制`;
    const iconText = combined.map((item) => item.icon).join('  ');
    const descriptionText = combined.map((item) => `• ${item.title}：${item.description}`).join('\n');
    const cardHeight = combined.length > 3 ? 410 : combined.length > 1 ? 330 : 250;
    const overlay = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x06100c, 0.76)
      .setOrigin(0).setInteractive();
    const card = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 54, cardHeight, 0x183b2c, 1)
      .setStrokeStyle(3, 0xffdc5e, 0.9);
    const cardLabel = this.score === 0 ? '新手说明 · 基础机制' : `第 ${this.score} 次过街 · 新机制`;
    const eyebrow = this.add.text(WIDTH / 2, HEIGHT / 2 - cardHeight / 2 + 28, cardLabel, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffdf68',
    }).setOrigin(0.5);
    const icon = this.add.text(WIDTH / 2, HEIGHT / 2 - cardHeight / 2 + 67, iconText, {
      fontFamily: 'sans-serif', fontSize: combined.length > 3 ? '26px' : '38px',
    }).setOrigin(0.5);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - cardHeight / 2 + 112, titleText, {
      fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    const description = this.add.text(
      WIDTH / 2,
      HEIGHT / 2 - cardHeight / 2 + 157,
      wrapMechanicDescription(descriptionText, 20),
      {
      fontFamily: 'sans-serif', fontSize: combined.length > 3 ? '12px' : '14px', color: '#d8f2e1', align: 'center',
      wordWrap: { width: WIDTH - 105 }, lineSpacing: 5,
      },
    ).setOrigin(0.5);
    const continueText = this.add.text(WIDTH / 2, HEIGHT / 2 + cardHeight / 2 - 23, '点击屏幕继续', {
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

  spawnDust(x, y, count) {
    for (let index = 0; index < count; index += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xe8dca9, 0.75).setDepth(8);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-18, 18),
        y: y + Phaser.Math.Between(-5, 10),
        scale: 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(220, 360),
        onComplete: () => particle.destroy(),
      });
    }
  }

  spawnCelebration() {
    const colors = [0xffdb61, 0xff7f6b, 0x7edb8a, 0x67c7ef, 0xffffff];
    for (let index = 0; index < 24; index += 1) {
      const particle = this.add.rectangle(
        WIDTH / 2,
        28,
        Phaser.Math.Between(3, 6),
        Phaser.Math.Between(5, 10),
        Phaser.Utils.Array.GetRandom(colors),
      ).setDepth(26).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: particle,
        x: WIDTH / 2 + Phaser.Math.Between(-175, 175),
        y: Phaser.Math.Between(75, 210),
        angle: Phaser.Math.Between(240, 720),
        alpha: 0,
        duration: Phaser.Math.Between(520, 850),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  update(time, delta) {
    if (this.gameOver || this.mechanicPaused) return;
    const seconds = delta / 1000;
    const heldDirection = this.touchDirection || this.keyboardDirection;
    if (heldDirection) this.tryMove(heldDirection.dx, heldDirection.dy);
    this.lanes.forEach((lane) => {
      if (lane.cars.length === 0 && time >= lane.nextWaveAt) this.spawnVehicleWave(lane);
    });

    [...this.cars].forEach((car) => {
      const laneVehicleXs = this.cars
        .filter((other) => other !== car && other.laneIndex === car.laneIndex)
        .map((other) => other.x);
      const turboWindow = this.activeMechanicKeys.has('turbo-cars')
        && car.isTurbo && Math.floor(time / 850) % 5 === 0;
      const hasSafeGap = canTurboBoost(
        car.x,
        laneVehicleXs,
        car.direction,
        WIDTH + 100,
        130,
      );
      const turbo = turboWindow && hasSafeGap ? 2.15 : 1;
      const alert = this.activeMechanicKeys.has('city-alert')
        && Math.floor(time / 650) % 7 === 0 ? 1.65 : 1;
      car.x += car.speed * car.direction * this.speedMultiplier * turbo * alert * seconds;
      car.visual.y = Math.sin(time * 0.008 + car.laneIndex) * 1.1;
      car.visual.rotation = Math.sin(time * 0.004 + car.laneIndex) * 0.008;
      const braking = turboWindow && !hasSafeGap;
      car.tailLampA.setScale(braking ? 1.7 : 1).setAlpha(braking ? 1 : 0.7);
      car.tailLampB.setScale(braking ? 1.7 : 1).setAlpha(braking ? 1 : 0.7);
      if (car.turboIcon.visible) car.turboIcon.setAlpha(turbo > 1 ? 1 : 0.38);
      if (turbo > 1 && Phaser.Math.Between(0, 2) === 0) {
        const trail = this.add.rectangle(
          car.x - car.direction * 42,
          car.y + Phaser.Math.Between(-10, 10),
          Phaser.Math.Between(12, 25),
          2,
          0xffe36e,
          0.65,
        ).setDepth(6);
        this.tweens.add({
          targets: trail,
          x: trail.x - car.direction * 30,
          alpha: 0,
          duration: 170,
          onComplete: () => trail.destroy(),
        });
      }
      if (Phaser.Math.Between(0, 50) === 0) this.spawnExhaust(car);
      const exited = car.direction > 0 ? car.x > WIDTH + 55 : car.x < -55;
      if (exited) {
        this.removeVehicle(car, time);
        return;
      }
      car.headlights.setPosition(car.x + car.direction * 29, car.y);

      if (isHit(
        { x: this.player.x, y: this.player.y, width: 28, height: 28 },
        { x: car.x, y: car.y, width: 66, height: 28 },
      ) && !this.scared) {
        if (isFrontalCollision(this.player.x, car.x, car.direction)) this.endGame();
        else this.scarePlayerBack(car);
      }
    });
    this.updateFog();
  }

  scarePlayerBack(car) {
    this.scared = true;
    this.moving = true;
    this.tweens.killTweensOf(this.player);
    this.idleTween.pause();
    this.position = this.moveOrigin ? { ...this.moveOrigin } : { ...this.position };
    this.playerVisual.setPosition(0, 0).setScale(1.08, 0.88);
    this.playerShadow.setScale(1).setAlpha(0.3);
    this.cameras.main.shake(120, 0.004);

    const warning = this.add.text(this.player.x + 20, this.player.y - 31, '！', {
      fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ff625f',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(18).setScale(0.2);
    this.tweens.add({
      targets: warning,
      y: warning.y - 12,
      scale: 1,
      alpha: 0,
      duration: 520,
      ease: 'Back.easeOut',
      onComplete: () => warning.destroy(),
    });
    this.tweens.add({
      targets: [this.eyeA, this.eyeB],
      scaleX: 1.65,
      scaleY: 1.65,
      duration: 90,
      yoyo: true,
      repeat: 1,
    });
    this.tweens.add({
      targets: this.playerVisual,
      angle: -car.direction * 11,
      duration: 70,
      yoyo: true,
      repeat: 2,
    });
    this.tweens.add({
      targets: this.player,
      x: this.cellX(this.position.col),
      y: this.cellY(this.position.row),
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.playerVisual.setPosition(0, 0).setScale(1).setAngle(0);
        this.eyeA.setScale(1);
        this.eyeB.setScale(1);
        this.scared = false;
        this.moving = false;
        this.idleTween.resume();
      },
    });
  }

  spawnExhaust(car) {
    const puff = this.add.container(
      car.x - car.direction * 39,
      car.y + Phaser.Math.Between(-4, 4),
    ).setDepth(5);
    puff.add([
      this.add.ellipse(-3, 1, 10, 7, 0xd9e1dc, 0.42),
      this.add.ellipse(3, -2, 8, 7, 0xe8ede8, 0.34),
      this.add.ellipse(7, 2, 6, 5, 0xf0f3ee, 0.24),
    ]);
    this.tweens.add({
      targets: puff,
      x: puff.x - car.direction * 14,
      y: puff.y - 11,
      scaleX: 1.9,
      scaleY: 1.55,
      angle: Phaser.Math.Between(-18, 18),
      alpha: 0,
      duration: 620,
      onComplete: () => puff.destroy(),
    });
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.cameras.main.shake(220, 0.012);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerVisual);
    this.spawnFeathers();
    const burstRing = this.add.circle(this.player.x, this.player.y, 13, 0xffffff, 0)
      .setStrokeStyle(5, 0xffe982, 0.9).setDepth(28);
    this.tweens.add({
      targets: burstRing,
      scale: 3.2,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => burstRing.destroy(),
    });
    this.createDuckSoul(this.player.x, this.player.y);
    this.player.setVisible(false).setActive(false);
    this.time.delayedCall(this.transitionTimings.gameOverOverlayDelay, () => {
      this.showGameOverOverlay();
    });
  }

  createDuckSoul(x, y) {
    const soul = this.add.container(x - 10, y).setDepth(29).setAlpha(0.78).setScale(0.82);
    const halo = this.add.ellipse(0, -24, 24, 7, 0xfff5b5, 0.25)
      .setStrokeStyle(2, 0xfff5b5, 0.9);
    const wingLeft = this.add.ellipse(-14, 3, 11, 18, 0xeafcff, 0.62).setAngle(-24);
    const wingRight = this.add.ellipse(14, 3, 11, 18, 0xeafcff, 0.62).setAngle(24);
    const body = this.add.ellipse(0, 4, 31, 35, 0xeafcff, 0.64)
      .setStrokeStyle(2, 0xffffff, 0.82);
    const face = this.add.circle(0, -7, 15, 0xf5ffff, 0.7)
      .setStrokeStyle(2, 0xffffff, 0.86);
    const eyeA = this.add.text(-6, -10, '⌒', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#56747a',
    }).setOrigin(0.5);
    const eyeB = this.add.text(6, -10, '⌒', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#56747a',
    }).setOrigin(0.5);
    const beak = this.add.ellipse(0, 0, 12, 5, 0xffd58a, 0.7);
    const soulVisual = this.add.container(0, 0, [halo, wingLeft, wingRight, body, face, eyeA, eyeB, beak]);
    soul.add(soulVisual);

    this.tweens.add({
      targets: soul,
      y: y - 145,
      duration: 1250,
      ease: 'Sine.easeOut',
      onComplete: () => soul.destroy(),
    });
    this.tweens.add({
      targets: soul,
      x: x + 10,
      duration: 135,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: soulVisual,
      angle: 8,
      duration: 135,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({ targets: soul, alpha: 0, duration: 350, delay: 900 });
  }

  showGameOverOverlay() {
    const backdrop = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07110d, 0)
      .setDepth(30);
    this.tweens.add({ targets: backdrop, alpha: 0.64, duration: 220 });
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 44, '撞车啦！', {
      fontFamily: 'sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(31).setAlpha(0).setScale(0.8);
    const score = this.add.text(WIDTH / 2, HEIGHT / 2 + 8, `成功过街 ${this.score} 次`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#c9eed7',
    }).setOrigin(0.5).setDepth(31).setAlpha(0);
    const hint = this.add.text(WIDTH / 2, HEIGHT / 2 + 60, '点击或按方向键重新开始', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffdf68',
    }).setOrigin(0.5).setDepth(31).setAlpha(0);
    this.tweens.add({
      targets: title, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: [score, hint], alpha: 1, duration: 260, delay: 120 });
    this.canRestart = true;
    this.input.once('pointerdown', () => this.scene.restart({ score: this.score }));
  }

  spawnFeathers() {
    for (let index = 0; index < 12; index += 1) {
      const feather = this.add.ellipse(this.player.x, this.player.y, 5, 10, 0xffe982, 0.9)
        .setDepth(29).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: feather,
        x: feather.x + Phaser.Math.Between(-75, 75),
        y: feather.y + Phaser.Math.Between(-65, 45),
        angle: Phaser.Math.Between(180, 720),
        alpha: 0,
        duration: Phaser.Math.Between(450, 800),
        ease: 'Quad.easeOut',
        onComplete: () => feather.destroy(),
      });
    }
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
