import { AudioEngine } from "./AudioEngine";
import { Input } from "./Input";

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 270;
const WORLD_WIDTH = 5480;
const GROUND_Y = 224;
const GROUND_DEPTH = 60;
const GRAVITY = 690;
const PLAYER_SPEED = 114;
const ULTIMATE_DURATION = 2.15;
const ULTIMATE_STRIKE_AT = 0.47;
const ULTIMATE_HITS_REQUIRED = 5;
const HELPER_TRIGGER_X = 2300;

type GameState = "idle" | "story" | "playing" | "upgrade" | "paused" | "cinematic" | "victory" | "dead";
type Upgrade = "fire" | "bell" | "moon" | null;
type EnemyKind = "lantern" | "hound" | "bird" | "boss";
type EnemyState = "idle" | "chase" | "telegraph" | "attack" | "dash" | "recover" | "stagger" | "dead";
type ProjectileKind = "charm" | "moon" | "bell" | "ember" | "feather" | "wave" | "seal" | "gadget";
type ParticleKind = "spark" | "paper" | "smoke" | "ember" | "shard" | "dust";
type DamageSource = "player" | "ultimate" | "helper";
type HelperState = "absent" | "entrance" | "follow" | "throw" | "cheer";

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  material: "wood" | "stone" | "metal";
  role: "ground" | "floating";
}

interface GroundSection {
  x: number;
  w: number;
  material: Platform["material"];
}

interface Prop {
  x: number;
  y: number;
  kind: "lantern" | "sign" | "urn";
  hp: number;
  broken: boolean;
  hitFlash: number;
}

interface Player {
  x: number;
  y: number;
  previousY: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  grounded: boolean;
  jumps: number;
  coyote: number;
  jumpBuffer: number;
  hp: number;
  maxHp: number;
  lives: number;
  invulnerable: number;
  attackTimer: number;
  attackDuration: number;
  attackBuffer: number;
  attackStep: number;
  attackKind: "slash" | "dive" | "ultimate";
  comboWindow: number;
  attackHitIds: Set<number>;
  charmCooldown: number;
  dashTimer: number;
  dashCooldown: number;
  focus: number;
  ultimateTimer: number;
  ultimateStruck: boolean;
  hurtTimer: number;
  landingTimer: number;
  runDistance: number;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  baseY: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  state: EnemyState;
  stateTimer: number;
  actionCooldown: number;
  invulnerable: number;
  hitFlash: number;
  attackKind: "slash" | "lunge" | "shot" | "wave" | "rain" | "cross";
  hitPlayer: boolean;
  phase: number;
  active: boolean;
  deathTimer: number;
}

interface Projectile {
  id: number;
  owner: "player" | "enemy" | "helper";
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  life: number;
  maxLife: number;
  damage: number;
  angle: number;
  returning: boolean;
  hitIds: Set<number>;
  gadgetFrame?: number;
}

interface Helper {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: HelperState;
  stateTimer: number;
  throwCooldown: number;
  gadgetCursor: number;
  gadgetLabel: string;
  labelTimer: number;
}

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  rotation: number;
  spin: number;
}

interface SlashEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  facing: 1 | -1;
  angle: number;
  color: string;
  heavy: boolean;
}

interface Afterimage {
  x: number;
  y: number;
  facing: 1 | -1;
  life: number;
  maxLife: number;
  pose: number;
  color: string;
}

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  critical: boolean;
}

interface DialogueLine {
  speaker: string;
  text: string;
}

interface GameCallbacks {
  onReturnToTitle: () => void;
}

interface AtlasFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  anchorX: number;
  anchorY: number;
}

const HERO_FRAMES: AtlasFrame[] = [
  { sx: 43, sy: 32, sw: 146, sh: 203, anchorX: 128, anchorY: 235 },
  { sx: 302, sy: 37, sw: 147, sh: 197, anchorX: 384, anchorY: 234 },
  { sx: 541, sy: 39, sw: 147, sh: 196, anchorX: 640, anchorY: 235 },
  { sx: 771, sy: 34, sw: 167, sh: 200, anchorX: 896, anchorY: 234 },
  { sx: 1014, sy: 48, sw: 200, sh: 186, anchorX: 1152, anchorY: 234 },
  { sx: 1283, sy: 50, sw: 202, sh: 184, anchorX: 1408, anchorY: 234 },
  { sx: 46, sy: 270, sw: 173, sh: 209, anchorX: 128, anchorY: 479 },
  { sx: 302, sy: 263, sw: 135, sh: 208, anchorX: 384, anchorY: 471 },
  { sx: 528, sy: 285, sw: 150, sh: 180, anchorX: 640, anchorY: 465 },
  { sx: 752, sy: 334, sw: 205, sh: 133, anchorX: 896, anchorY: 467 },
  { sx: 1014, sy: 303, sw: 195, sh: 165, anchorX: 1152, anchorY: 468 },
  { sx: 1259, sy: 304, sw: 237, sh: 170, anchorX: 1408, anchorY: 474 },
  { sx: 13, sy: 545, sw: 233, sh: 169, anchorX: 128, anchorY: 714 },
  { sx: 272, sy: 541, sw: 210, sh: 173, anchorX: 384, anchorY: 714 },
  { sx: 501, sy: 525, sw: 238, sh: 187, anchorX: 640, anchorY: 712 },
  { sx: 782, sy: 508, sw: 196, sh: 196, anchorX: 896, anchorY: 704 },
  { sx: 1042, sy: 518, sw: 146, sh: 196, anchorX: 1152, anchorY: 714 },
  { sx: 1264, sy: 534, sw: 133, sh: 180, anchorX: 1408, anchorY: 714 },
  { sx: 25, sy: 772, sw: 154, sh: 191, anchorX: 128, anchorY: 963 },
  { sx: 268, sy: 776, sw: 189, sh: 187, anchorX: 384, anchorY: 963 },
  { sx: 509, sy: 773, sw: 177, sh: 190, anchorX: 640, anchorY: 963 },
  { sx: 734, sy: 767, sw: 164, sh: 196, anchorX: 896, anchorY: 963 },
  { sx: 968, sy: 733, sw: 271, sh: 233, anchorX: 1152, anchorY: 966 },
  { sx: 1287, sy: 760, sw: 181, sh: 204, anchorX: 1408, anchorY: 964 },
];

const ENEMY_FRAMES: AtlasFrame[][] = [
  [
    { sx: 43, sy: 48, sw: 164, sh: 235, anchorX: 140, anchorY: 283 },
    { sx: 298, sy: 73, sw: 183, sh: 204, anchorX: 420.5, anchorY: 277 },
    { sx: 603, sy: 27, sw: 122, sh: 255, anchorX: 701, anchorY: 282 },
    { sx: 802, sy: 78, sw: 282, sh: 207, anchorX: 981.5, anchorY: 285 },
    { sx: 1177, sy: 100, sw: 172, sh: 183, anchorX: 1262, anchorY: 283 },
  ],
  [
    { sx: 48, sy: 375, sw: 164, sh: 132, anchorX: 140, anchorY: 507 },
    { sx: 286, sy: 390, sw: 206, sh: 115, anchorX: 420.5, anchorY: 505 },
    { sx: 554, sy: 363, sw: 216, sh: 148, anchorX: 701, anchorY: 511 },
    { sx: 829, sy: 395, sw: 274, sh: 109, anchorX: 981.5, anchorY: 504 },
    { sx: 1179, sy: 366, sw: 177, sh: 145, anchorX: 1262, anchorY: 511 },
  ],
  [
    { sx: 28, sy: 560, sw: 206, sh: 194, anchorX: 140, anchorY: 754 },
    { sx: 285, sy: 599, sw: 198, sh: 153, anchorX: 420.5, anchorY: 752 },
    { sx: 554, sy: 616, sw: 211, sh: 144, anchorX: 701, anchorY: 760 },
    { sx: 829, sy: 636, sw: 253, sh: 116, anchorX: 981.5, anchorY: 752 },
    { sx: 1137, sy: 589, sw: 210, sh: 170, anchorX: 1262, anchorY: 759 },
  ],
  [
    { sx: 18, sy: 827, sw: 212, sh: 229, anchorX: 140, anchorY: 1056 },
    { sx: 308, sy: 787, sw: 171, sh: 271, anchorX: 420.5, anchorY: 1058 },
    { sx: 512, sy: 848, sw: 256, sh: 208, anchorX: 701, anchorY: 1056 },
    { sx: 820, sy: 869, sw: 273, sh: 184, anchorX: 981.5, anchorY: 1053 },
    { sx: 1134, sy: 857, sw: 217, sh: 201, anchorX: 1262, anchorY: 1058 },
  ],
];

const PROP_FRAMES = {
  roof: { sx: 21, sy: 116, sw: 335, sh: 167, anchorX: 162, anchorY: 176 },
  stone: { sx: 380, sy: 137, sw: 296, sh: 158, anchorX: 486, anchorY: 176 },
  brass: { sx: 705, sy: 79, sw: 292, sh: 204, anchorX: 809.5, anchorY: 174 },
  lantern: { sx: 85, sy: 345, sw: 212, sh: 215, anchorX: 162, anchorY: 560 },
  sign: { sx: 407, sy: 338, sw: 118, sh: 222, anchorX: 486, anchorY: 560 },
  urn: { sx: 678, sy: 371, sw: 159, sh: 189, anchorX: 809.5, anchorY: 560 },
  rubble: { sx: 1218, sy: 409, sw: 323, sh: 138, anchorX: 1457, anchorY: 547 },
  shrine: { sx: 45, sy: 624, sw: 266, sh: 249, anchorX: 162, anchorY: 873 },
  gate: { sx: 341, sy: 605, sw: 305, sh: 267, anchorX: 486, anchorY: 872 },
  brokenGate: { sx: 691, sy: 617, sw: 255, sh: 255, anchorX: 809.5, anchorY: 872 },
  goldRubble: { sx: 968, sy: 730, sw: 280, sh: 144, anchorX: 1133, anchorY: 874 },
  pillar: { sx: 1335, sy: 591, sw: 152, sh: 281, anchorX: 1457, anchorY: 872 },
} satisfies Record<string, AtlasFrame>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function seeded(index: number): number {
  const value = Math.sin(index * 91.731 + 17.13) * 43758.5453;
  return value - Math.floor(value);
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

function loadGameImage(path: string): HTMLImageElement {
  const image = new Image();
  image.decoding = "async";
  image.src = path;
  return image;
}

function imageReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function drawAtlasFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: AtlasFrame,
  rootX: number,
  rootY: number,
  direction: 1 | -1,
  scale: number,
  alpha = 1,
  filter = "none",
): void {
  const padding = 3;
  const sx = Math.max(0, frame.sx - padding);
  const sy = Math.max(0, frame.sy - padding);
  const sw = Math.min(image.naturalWidth - sx, frame.sw + padding * 2);
  const sh = Math.min(image.naturalHeight - sy, frame.sh + padding * 2);
  context.save();
  context.translate(Math.round(rootX), Math.round(rootY));
  context.scale(direction, 1);
  context.globalAlpha = alpha;
  context.filter = filter;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    (sx - frame.anchorX) * scale,
    (sy - frame.anchorY) * scale,
    sw * scale,
    sh * scale,
  );
  context.restore();
}

export class Game {
  readonly audio: AudioEngine;
  private context: CanvasRenderingContext2D;
  private input: Input;
  private callbacks: GameCallbacks;
  private state: GameState = "idle";
  private previousState: GameState = "playing";
  private lastFrame = performance.now();
  private elapsed = 0;
  private runTime = 0;
  private cameraX = 0;
  private cameraY = 0;
  private targetCameraX = 0;
  private hitStop = 0;
  private shake = 0;
  private shakeScale = 1;
  private flashes = true;
  private whiteFlash = 0;
  private redFlash = 0;
  private goldenTime = 0;
  private dawn = 0;
  private checkpointX = 70;
  private upgrade: Upgrade = null;
  private upgradeTriggered = false;
  private helperTriggered = false;
  private midStoryTriggered = false;
  private bossTriggered = false;
  private bossDefeated = false;
  private bossIntroTimer = 0;
  private victoryCountdown = 0;
  private deathTimer = 0;
  private skillName = "";
  private skillNameTimer = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private score = 0;
  private perfectDodges = 0;
  private hitsTaken = 0;
  private nextEntityId = 1;
  private platforms: Platform[] = [];
  private groundSections: GroundSection[] = [];
  private props: Prop[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private slashes: SlashEffect[] = [];
  private afterimages: Afterimage[] = [];
  private damageNumbers: DamageNumber[] = [];
  private dialogue: DialogueLine[] = [];
  private dialogueIndex = 0;
  private dialogueTyped = 0;
  private dialogueOnDone: (() => void) | null = null;
  private footstepTimer = 0;
  private player: Player = this.createPlayer();
  private helper: Helper = this.createHelper();
  private heroSheet = loadGameImage("/assets/game/hero-sprites.png");
  private helperSheet = loadGameImage("/assets/game/helper-sprites.png");
  private gadgetSheet = loadGameImage("/assets/game/gadget-sprites.png");
  private enemySheet = loadGameImage("/assets/game/enemy-sprites.png");
  private propsSheet = loadGameImage("/assets/game/props.png");
  private backgroundPlate = loadGameImage("/assets/game/glass-slope-background.png");
  private gmkCutin = loadGameImage("/assets/game/gmk-cutin.png");

  private storyOverlay = element<HTMLDivElement>("story-overlay");
  private storySpeaker = element<HTMLParagraphElement>("story-speaker");
  private storyText = element<HTMLParagraphElement>("story-text");
  private storyHint = element<HTMLSpanElement>("story-hint");
  private upgradeOverlay = element<HTMLDivElement>("upgrade-overlay");
  private pauseOverlay = element<HTMLDivElement>("pause-overlay");
  private resultsOverlay = element<HTMLDivElement>("results-overlay");
  private bossTitle = element<HTMLDivElement>("boss-title");
  private cinemaBars = element<HTMLDivElement>("cinema-bars");
  private ariaLive = element<HTMLDivElement>("aria-live");
  private ultimateButton = document.querySelector<HTMLButtonElement>('[data-control="ultimate"]');
  private ultimateTouchCount = element<HTMLElement>("gmk-touch-count");

  constructor(canvas: HTMLCanvasElement, audio: AudioEngine, callbacks: GameCallbacks) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.context = context;
    this.context.imageSmoothingEnabled = false;
    this.audio = audio;
    this.callbacks = callbacks;
    this.input = new Input();
    this.buildWorld();
    this.syncUltimateUi();
    this.storyOverlay.addEventListener("click", () => this.advanceDialogue());
    this.loop(performance.now());
  }

  get isPaused(): boolean {
    return this.state === "paused";
  }

  get shakeEnabled(): boolean {
    return this.shakeScale > 0;
  }

  get flashesEnabled(): boolean {
    return this.flashes;
  }

  start(): void {
    this.resetRun();
    this.state = "story";
    this.audio.setMode("explore");
    const debug = new URLSearchParams(window.location.search).get("debug");
    if (debug === "boss" || debug === "victory") {
      this.state = "playing";
      this.player.x = 4240;
      this.player.focus = ULTIMATE_HITS_REQUIRED;
      this.player.invulnerable = 999;
      this.cameraX = 4080;
      this.checkpointX = 4150;
      this.upgrade = "moon";
      this.upgradeTriggered = true;
      this.helperTriggered = true;
      this.helper = this.createHelper();
      this.helper.active = true;
      this.helper.state = "follow";
      this.helper.x = this.player.x - 64;
      this.helper.y = this.player.y - 4;
      this.midStoryTriggered = true;
      this.syncUltimateUi();
      this.triggerBoss();
      if (debug === "victory") {
        const boss = this.enemies.find((enemy) => enemy.kind === "boss");
        if (boss) {
          boss.hp = 0;
          boss.state = "dead";
          boss.deathTimer = 2.4;
          this.onBossDefeated(boss);
          this.state = "playing";
          this.bossTitle.classList.remove("is-visible");
          this.victoryCountdown = 0.45;
        }
      }
      return;
    }

    this.showDialogue(
      [
        { speaker: "記録・第零頁", text: "太陽が九つに砕けて百年。灯京に、朝は来ない。" },
        { speaker: "某美少女N", text: "私の名？　記録には、そう――『某美少女N』とだけ。十分よ。" },
        { speaker: "某美少女N", text: "日輪符を取り戻す。たとえ、そのたびに何かを忘れても。" },
      ],
      () => {
        this.state = "playing";
        this.announce("第一夜　玻璃坂の残照");
      },
    );
  }

  stop(): void {
    this.state = "idle";
    this.input.reset();
    this.storyOverlay.classList.remove("is-visible");
    this.pauseOverlay.classList.remove("is-visible");
    this.upgradeOverlay.classList.remove("is-visible");
    this.resultsOverlay.classList.remove("is-visible");
    this.bossTitle.classList.remove("is-visible");
    this.cinemaBars.classList.remove("is-visible");
    this.audio.setMode("explore");
  }

  releaseInputs(): void {
    this.input.reset();
  }

  togglePause(): void {
    if (this.state === "paused") {
      this.resume();
      return;
    }
    if (this.state !== "playing") return;
    this.previousState = this.state;
    this.state = "paused";
    this.input.reset();
    this.pauseOverlay.classList.add("is-visible");
    this.announce("一時停止");
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = this.previousState === "paused" ? "playing" : this.previousState;
    this.pauseOverlay.classList.remove("is-visible");
    this.input.reset();
  }

  returnToTitle(): void {
    this.stop();
    this.callbacks.onReturnToTitle();
  }

  selectUpgrade(upgrade: Exclude<Upgrade, null>): void {
    if (this.state !== "upgrade") return;
    this.upgrade = upgrade;
    this.upgradeOverlay.classList.remove("is-visible");
    this.audio.sfx("select");
    const names: Record<Exclude<Upgrade, null>, string> = {
      fire: "猫又火",
      bell: "金鈴返し",
      moon: "残月爪",
    };
    this.setSkillName(names[upgrade], 1.2);
    this.spawnBurst(this.player.x, this.player.y + 10, "#ffbd45", 34, "ember");
    this.state = "playing";
    this.checkpointX = 2030;
    this.announce(`${names[upgrade]}を得た`);
  }

  setShakeEnabled(enabled: boolean): void {
    this.shakeScale = enabled ? 1 : 0;
  }

  setFlashesEnabled(enabled: boolean): void {
    this.flashes = enabled;
  }

  private createPlayer(): Player {
    return {
      x: 70,
      y: GROUND_Y - 38,
      previousY: GROUND_Y - 38,
      vx: 0,
      vy: 0,
      w: 18,
      h: 38,
      facing: 1,
      grounded: false,
      jumps: 0,
      coyote: 0,
      jumpBuffer: 0,
      hp: 500,
      maxHp: 500,
      lives: 9,
      invulnerable: 0,
      attackTimer: 0,
      attackDuration: 0,
      attackBuffer: 0,
      attackStep: 0,
      attackKind: "slash",
      comboWindow: 0,
      attackHitIds: new Set(),
      charmCooldown: 0,
      dashTimer: 0,
      dashCooldown: 0,
      focus: 0,
      ultimateTimer: 0,
      ultimateStruck: false,
      hurtTimer: 0,
      landingTimer: 0,
      runDistance: 0,
    };
  }

  private createHelper(): Helper {
    return {
      active: false,
      x: 0,
      y: 176,
      vx: 0,
      facing: 1,
      state: "absent",
      stateTimer: 0,
      throwCooldown: 0.72,
      gadgetCursor: 0,
      gadgetLabel: "",
      labelTimer: 0,
    };
  }

  private resetRun(): void {
    this.state = "idle";
    this.player = this.createPlayer();
    this.helper = this.createHelper();
    this.cameraX = 0;
    this.cameraY = 0;
    this.elapsed = 0;
    this.runTime = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.whiteFlash = 0;
    this.redFlash = 0;
    this.goldenTime = 0;
    this.dawn = 0;
    this.checkpointX = 70;
    this.upgrade = null;
    this.upgradeTriggered = false;
    this.helperTriggered = false;
    this.midStoryTriggered = false;
    this.bossTriggered = false;
    this.bossDefeated = false;
    this.bossIntroTimer = 0;
    this.victoryCountdown = 0;
    this.deathTimer = 0;
    this.skillName = "";
    this.skillNameTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.perfectDodges = 0;
    this.hitsTaken = 0;
    this.nextEntityId = 1;
    this.projectiles = [];
    this.particles = [];
    this.slashes = [];
    this.afterimages = [];
    this.damageNumbers = [];
    this.props = this.createProps();
    this.enemies = this.createEnemies();
    this.storyOverlay.classList.remove("is-visible");
    this.upgradeOverlay.classList.remove("is-visible");
    this.pauseOverlay.classList.remove("is-visible");
    this.resultsOverlay.classList.remove("is-visible");
    this.bossTitle.classList.remove("is-visible");
    this.cinemaBars.classList.remove("is-visible");
    this.input.reset();
    this.syncUltimateUi();
  }

  private buildWorld(): void {
    this.groundSections = [
      { x: 0, w: 862, material: "wood" },
      { x: 862, w: 590, material: "stone" },
      { x: 1452, w: 622, material: "wood" },
      { x: 2074, w: 696, material: "stone" },
      { x: 2770, w: 742, material: "wood" },
      { x: 3512, w: 798, material: "metal" },
      { x: 4310, w: 1170, material: "stone" },
    ];
    this.platforms = [
      { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: GROUND_DEPTH, material: "stone", role: "ground" },
      { x: 505, y: 176, w: 176, h: 9, material: "wood", role: "floating" },
      { x: 1070, y: 164, w: 212, h: 9, material: "stone", role: "floating" },
      { x: 1565, y: 176, w: 145, h: 8, material: "wood", role: "floating" },
      { x: 2440, y: 164, w: 176, h: 8, material: "stone", role: "floating" },
      { x: 2960, y: 173, w: 192, h: 8, material: "wood", role: "floating" },
      { x: 3290, y: 142, w: 138, h: 8, material: "metal", role: "floating" },
      { x: 3730, y: 169, w: 202, h: 9, material: "metal", role: "floating" },
    ];
    this.assertContinuousGround();
    this.props = this.createProps();
    this.enemies = this.createEnemies();
  }

  private assertContinuousGround(): void {
    const ground = this.platforms.find((platform) => platform.role === "ground");
    if (!ground || ground.x > 0 || ground.x + ground.w < WORLD_WIDTH || ground.y !== GROUND_Y) {
      throw new Error("Main ground collider must cover the complete world");
    }

    let coveredUntil = 0;
    for (const section of [...this.groundSections].sort((a, b) => a.x - b.x)) {
      if (section.x > coveredUntil) throw new Error(`Ground visual gap detected at x=${coveredUntil}`);
      coveredUntil = Math.max(coveredUntil, section.x + section.w);
    }
    if (coveredUntil < WORLD_WIDTH) throw new Error(`Ground visual gap detected at x=${coveredUntil}`);
  }

  private createProps(): Prop[] {
    const points: Array<[number, Prop["kind"]]> = [
      [340, "lantern"], [752, "sign"], [970, "urn"], [1360, "lantern"],
      [1810, "lantern"], [2330, "sign"], [2710, "urn"], [3070, "lantern"],
      [3440, "sign"], [3830, "lantern"], [4160, "urn"], [4510, "lantern"],
      [4970, "lantern"],
    ];
    return points.map(([x, kind]) => ({ x, y: GROUND_Y, kind, hp: kind === "urn" ? 1 : 2, broken: false, hitFlash: 0 }));
  }

  private createEnemies(): Enemy[] {
    const enemies: Enemy[] = [];
    const add = (kind: EnemyKind, x: number, y: number | "ground") => {
      const boss = kind === "boss";
      const size = kind === "hound" ? [27, 19] : kind === "bird" ? [25, 20] : boss ? [24, 45] : [20, 35];
      const hp = boss ? 640 : kind === "lantern" ? 72 : kind === "hound" ? 58 : 50;
      const resolvedY = y === "ground" ? GROUND_Y - size[1] : y;
      enemies.push({
        id: this.nextEntityId++, kind, x, y: resolvedY, baseY: resolvedY, vx: 0, vy: 0, w: size[0], h: size[1], facing: -1,
        hp, maxHp: hp, poise: 0, maxPoise: boss ? 130 : 48, state: "idle", stateTimer: 0,
        actionCooldown: seeded(x) * 0.8, invulnerable: 0, hitFlash: 0, attackKind: "slash", hitPlayer: false,
        phase: 1, active: !boss, deathTimer: 0,
      });
    };
    add("lantern", 630, "ground");
    add("hound", 920, "ground");
    add("bird", 1250, 132);
    add("lantern", 1580, "ground");
    add("hound", 1880, "ground");
    add("bird", 2460, 126);
    add("lantern", 2890, "ground");
    add("hound", 3160, "ground");
    add("bird", 3370, 106);
    add("lantern", 3710, "ground");
    add("hound", 4050, "ground");
    add("boss", 4750, "ground");
    return enemies;
  }

  private loop(now: number): void {
    const rawDelta = Math.min(0.033, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.elapsed += rawDelta;
    this.input.pollGamepad();

    if (this.input.consume("pause")) this.togglePause();
    if (this.state === "story") {
      this.updateDialogue(rawDelta);
      if (this.input.consume("confirm") || this.input.consume("attack")) this.advanceDialogue();
    } else if (this.state === "playing" || this.state === "cinematic" || this.state === "dead") {
      this.updateFrame(rawDelta);
    } else if (this.state === "paused" || this.state === "upgrade" || this.state === "victory") {
      this.updateParticles(rawDelta * 0.25);
    }

    this.render();
    window.requestAnimationFrame((time) => this.loop(time));
  }

  private updateFrame(rawDelta: number): void {
    if (this.hitStop > 0) {
      this.hitStop -= rawDelta;
      this.updateParticles(rawDelta * 0.12);
      this.updateVisualTimers(rawDelta);
      return;
    }

    const slowScale = this.goldenTime > 0 ? 0.26 : 1;
    const delta = rawDelta * slowScale;
    this.updateVisualTimers(rawDelta);
    this.runTime += this.state === "playing" ? rawDelta : 0;

    if (this.state === "dead") {
      this.deathTimer -= rawDelta;
      this.updateParticles(delta);
      if (this.deathTimer <= 0) this.respawn();
      return;
    }

    if (this.state === "cinematic") {
      this.updateCinematic(rawDelta);
      this.updateParticles(delta);
      return;
    }

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateHelper(delta);
    this.updateProjectiles(delta);
    this.updateParticles(delta);
    this.updateProps(delta);
    this.updateCamera(delta);
    this.checkTriggers();

    if (this.comboTimer > 0) this.comboTimer -= delta;
    else if (this.combo > 0) this.combo = 0;

    if (this.victoryCountdown > 0) {
      this.victoryCountdown -= rawDelta;
      this.dawn = clamp(this.dawn + rawDelta * 0.34, 0, 1);
      if (this.victoryCountdown <= 0) this.showResults();
    }
  }

  private updateVisualTimers(delta: number): void {
    this.whiteFlash = Math.max(0, this.whiteFlash - delta * 3.8);
    this.redFlash = Math.max(0, this.redFlash - delta * 2.8);
    this.shake = Math.max(0, this.shake - delta * 21);
    this.goldenTime = Math.max(0, this.goldenTime - delta);
    this.skillNameTimer = Math.max(0, this.skillNameTimer - delta);
  }

  private updatePlayer(delta: number): void {
    const player = this.player;
    player.previousY = player.y;
    if (player.y + player.h > GROUND_Y + 14) this.recoverPlayerToGround();
    player.invulnerable = Math.max(0, player.invulnerable - delta);
    player.attackTimer = Math.max(0, player.attackTimer - delta);
    player.attackBuffer = Math.max(0, player.attackBuffer - delta);
    player.charmCooldown = Math.max(0, player.charmCooldown - delta);
    player.dashCooldown = Math.max(0, player.dashCooldown - delta);
    player.hurtTimer = Math.max(0, player.hurtTimer - delta);
    player.landingTimer = Math.max(0, player.landingTimer - delta);
    player.comboWindow = Math.max(0, player.comboWindow - delta);
    player.coyote = player.grounded ? 0.105 : Math.max(0, player.coyote - delta);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - delta);

    if (this.input.consume("jump")) player.jumpBuffer = 0.12;
    if (this.input.consume("attack")) player.attackBuffer = 0.13;
    if (this.input.consume("charm")) this.throwCharm();
    if (this.input.consume("dash")) this.startDash();
    if (this.input.consume("ultimate")) this.startUltimate();
    if (player.attackBuffer > 0) this.startAttack();

    if (player.ultimateTimer > 0) {
      this.updateUltimate(delta);
      return;
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= delta;
      player.vx = player.facing * 292;
      player.vy = 0;
      if (Math.floor(player.dashTimer * 90) % 2 === 0) this.spawnAfterimage("#ffbd45");
    } else if (player.hurtTimer <= 0) {
      const horizontal = (this.input.down("right") ? 1 : 0) - (this.input.down("left") ? 1 : 0);
      if (horizontal !== 0) {
        player.facing = horizontal as 1 | -1;
        const acceleration = player.grounded ? 840 : 510;
        player.vx += horizontal * acceleration * delta;
        player.vx = clamp(player.vx, -PLAYER_SPEED, PLAYER_SPEED);
      } else {
        const drag = player.grounded ? 820 : 95;
        if (Math.abs(player.vx) <= drag * delta) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * drag * delta;
      }
    }

    if (player.jumpBuffer > 0 && (player.coyote > 0 || player.jumps < 2)) {
      const isDouble = !player.grounded && player.coyote <= 0;
      player.vy = isDouble ? -218 : -244;
      player.grounded = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      player.jumps += 1;
      this.audio.sfx("jump");
      this.spawnDust(player.x, player.y + player.h, 7, isDouble ? "#ffbd45" : "#9bb6bc");
      if (isDouble) this.addRing(player.x, player.y + player.h * 0.65, "#ffbd45", 16);
    }

    if (!this.input.down("jump") && player.vy < -80) player.vy += GRAVITY * 1.55 * delta;
    if (!player.grounded && player.dashTimer <= 0) player.vy = Math.min(360, player.vy + GRAVITY * delta);

    const oldX = player.x;
    player.x += player.vx * delta;
    player.y += player.vy * delta;
    player.x = clamp(player.x, 8, WORLD_WIDTH - player.w - 8);
    if (this.bossTriggered && !this.bossDefeated) player.x = clamp(player.x, 4240, 5230);

    this.resolvePlayerPlatforms();

    const distance = Math.abs(player.x - oldX);
    player.runDistance += distance;
    this.footstepTimer -= delta;
    if (player.grounded && distance > 0.35 && this.footstepTimer <= 0) {
      this.audio.footstep(this.platformMaterialBelow(player.x + player.w / 2));
      this.spawnDust(player.x + player.w / 2, player.y + player.h, 2, "#6d6475");
      this.footstepTimer = 0.26;
    }

    if (player.attackTimer > 0) this.resolvePlayerAttack();
  }

  private resolvePlayerPlatforms(): void {
    const player = this.player;
    const previousBottom = player.previousY + player.h;
    const currentBottom = player.y + player.h;
    let landing: Platform | null = null;

    if (player.vy >= 0) {
      for (const platform of this.platforms) {
        const overlapsX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
        if (overlapsX && previousBottom <= platform.y + 3 && currentBottom >= platform.y) {
          if (!landing || platform.y < landing.y) landing = platform;
        }
      }
    }

    if (landing) {
      const wasFallingFast = player.vy > 175;
      player.y = landing.y - player.h;
      player.vy = 0;
      if (!player.grounded) {
        player.landingTimer = 0.16;
        player.jumps = 0;
        if (wasFallingFast) {
          this.audio.sfx("land");
          this.spawnDust(player.x + player.w / 2, landing.y, 12, "#8f7c86");
          this.shake = Math.max(this.shake, 1.3 * this.shakeScale);
        }
      }
      player.grounded = true;
    } else {
      player.grounded = false;
    }
  }

  private recoverPlayerToGround(): void {
    const player = this.player;
    player.y = GROUND_Y - player.h;
    player.previousY = player.y;
    player.vy = 0;
    player.dashTimer = 0;
    player.grounded = true;
    player.jumps = 0;
    player.coyote = 0.105;
    player.invulnerable = Math.max(player.invulnerable, 0.35);
    this.announce("足場へ安全復帰");
  }

  private platformMaterialBelow(x: number): Platform["material"] {
    const platform = this.platforms.find((item) => x >= item.x && x <= item.x + item.w && Math.abs(item.y - (this.player.y + this.player.h)) < 5);
    if (!platform) return "wood";
    if (platform.role === "floating") return platform.material;
    return this.groundSections.find((section) => x >= section.x && x <= section.x + section.w)?.material ?? "stone";
  }

  private startAttack(): void {
    const player = this.player;
    if (player.hurtTimer > 0 || player.dashTimer > 0 || player.ultimateTimer > 0) return;
    if (player.attackTimer > 0.085) return;

    if (!player.grounded && this.input.down("down")) {
      player.attackKind = "dive";
      player.attackStep = 3;
      player.attackDuration = 0.38;
      player.attackTimer = 0.38;
      player.vy = 315;
      this.setSkillName("落星爪", 0.58);
      this.audio.sfx("heavy");
    } else {
      player.attackKind = "slash";
      player.attackStep = player.comboWindow > 0 ? (player.attackStep % 3) + 1 : 1;
      player.attackDuration = player.attackStep === 3 ? 0.31 : 0.23;
      player.attackTimer = player.attackDuration;
      player.comboWindow = 0.48;
      this.audio.sfx(player.attackStep === 3 ? "heavy" : "attack");
      if (player.attackStep === 3) this.setSkillName("三日月・散華", 0.52);
    }
    player.attackHitIds.clear();
    player.attackBuffer = 0;
    const radius = player.attackStep === 3 ? 42 : 31;
    this.slashes.push({
      x: player.x + player.w / 2 + player.facing * 9,
      y: player.y + 18,
      life: 0.16,
      maxLife: 0.16,
      radius,
      facing: player.facing,
      angle: player.attackStep === 2 ? -0.6 : player.attackStep === 3 ? 0.1 : 0.7,
      color: player.attackStep === 3 ? "#ffe69a" : "#f2b7a1",
      heavy: player.attackStep === 3,
    });
  }

  private resolvePlayerAttack(): void {
    const player = this.player;
    const progress = 1 - player.attackTimer / player.attackDuration;
    const active = player.attackKind === "dive" ? progress > 0.25 : progress > 0.18 && progress < 0.82;
    if (!active) return;

    const range = player.attackKind === "dive" ? 34 : player.attackStep === 3 ? 51 : 38;
    const attackX = player.facing > 0 ? player.x + player.w - 3 : player.x - range + 3;
    const attackY = player.attackKind === "dive" ? player.y + 18 : player.y + 4;
    const attackH = player.attackKind === "dive" ? 32 : 31;
    const damage = player.attackKind === "dive" ? 32 : player.attackStep === 3 ? 27 : 16 + player.attackStep * 2;
    const poise = player.attackKind === "dive" ? 32 : player.attackStep === 3 ? 26 : 13;

    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.state === "dead" || player.attackHitIds.has(enemy.id)) continue;
      if (rectsOverlap(attackX, attackY, range, attackH, enemy.x, enemy.y, enemy.w, enemy.h)) {
        player.attackHitIds.add(enemy.id);
        this.damageEnemy(enemy, damage, poise, player.facing * (player.attackStep === 3 ? 145 : 70), player.attackStep === 3);
      }
    }

    for (const prop of this.props) {
      if (prop.broken) continue;
      if (rectsOverlap(attackX, attackY, range, attackH, prop.x - 8, prop.y - 28, 16, 28)) this.damageProp(prop);
    }

    if (this.upgrade === "moon" && player.attackStep === 3 && progress > 0.54 && progress < 0.7 && !player.attackHitIds.has(-999)) {
      player.attackHitIds.add(-999);
      this.projectiles.push({
        id: this.nextEntityId++, owner: "player", kind: "moon", x: player.x + player.facing * 22, y: player.y + 15,
        vx: player.facing * 245, vy: 0, w: 29, h: 34, life: 1.1, maxLife: 1.1, damage: 22,
        angle: 0, returning: false, hitIds: new Set(),
      });
    }
  }

  private throwCharm(): void {
    const player = this.player;
    if (player.charmCooldown > 0 || player.hurtTimer > 0 || player.ultimateTimer > 0) return;
    player.charmCooldown = 1.05;
    this.projectiles.push({
      id: this.nextEntityId++, owner: "player", kind: "charm", x: player.x + player.w / 2, y: player.y + 15,
      vx: player.facing * 210, vy: -16, w: 13, h: 13, life: 1.25, maxLife: 1.25, damage: 15,
      angle: 0, returning: false, hitIds: new Set(),
    });
    this.audio.sfx("charm");
    this.setSkillName("日輪符・帰燕", 0.48);
  }

  private startDash(): void {
    const player = this.player;
    if (player.dashCooldown > 0 || player.hurtTimer > 0 || player.ultimateTimer > 0) return;
    player.dashTimer = 0.19;
    player.dashCooldown = 0.46;
    player.invulnerable = Math.max(player.invulnerable, 0.31);
    player.attackTimer = 0;
    this.audio.sfx("dash");
    this.setSkillName("影走り", 0.36);
    this.spawnAfterimage("#7be1d9");
    this.spawnDust(player.x + player.w / 2, player.y + player.h, 10, "#32243d");

    const danger = this.enemies.some((enemy) => this.enemyThreatensPlayer(enemy));
    if (danger) this.triggerPerfectDodge();
  }

  private enemyThreatensPlayer(enemy: Enemy): boolean {
    if (!enemy.active || enemy.state === "dead") return false;
    const distance = Math.abs(enemy.x + enemy.w / 2 - (this.player.x + this.player.w / 2));
    const reach = enemy.kind === "boss" ? 105 : enemy.kind === "hound" ? 92 : 68;
    return distance < reach && (enemy.state === "telegraph" || enemy.state === "attack" || enemy.state === "dash") && enemy.stateTimer < 0.22;
  }

  private triggerPerfectDodge(): void {
    const player = this.player;
    this.goldenTime = 0.46;
    this.hitStop = Math.max(this.hitStop, 0.035);
    this.shake = Math.max(this.shake, 3.3 * this.shakeScale);
    this.whiteFlash = this.flashes ? 0.38 : 0.08;
    player.invulnerable = Math.max(player.invulnerable, 0.42);
    this.perfectDodges += 1;
    this.score += 280;
    this.setSkillName("金刻・完全回避", 0.95);
    this.audio.sfx("dodge");
    this.addRing(player.x + player.w / 2, player.y + 18, "#ffe69a", 46);
    this.spawnBurst(player.x + player.w / 2, player.y + 17, "#ffbd45", 28, "spark");
    this.announce("完全回避");

    if (this.upgrade === "bell") {
      for (const angle of [-0.38, 0, 0.38]) {
        this.projectiles.push({
          id: this.nextEntityId++, owner: "player", kind: "bell", x: player.x + player.w / 2, y: player.y + 15,
          vx: player.facing * Math.cos(angle) * 255, vy: Math.sin(angle) * 255, w: 8, h: 8,
          life: 0.85, maxLife: 0.85, damage: 14, angle, returning: false, hitIds: new Set(),
        });
      }
    }
  }

  private startUltimate(): void {
    const player = this.player;
    if (player.focus < ULTIMATE_HITS_REQUIRED || player.ultimateTimer > 0 || player.hurtTimer > 0) {
      if (player.focus < ULTIMATE_HITS_REQUIRED) {
        this.announce(`GMKまであと${ULTIMATE_HITS_REQUIRED - player.focus}回命中`);
      }
      return;
    }
    player.focus = 0;
    this.syncUltimateUi();
    player.ultimateTimer = ULTIMATE_DURATION;
    player.ultimateStruck = false;
    player.attackKind = "ultimate";
    player.invulnerable = ULTIMATE_DURATION + 0.25;
    player.vx = 0;
    player.vy = 0;
    this.cinemaBars.classList.add("is-visible");
    this.setSkillName("GMK", ULTIMATE_DURATION + 0.15);
    this.audio.sfx("ultimate");
  }

  private updateUltimate(delta: number): void {
    const player = this.player;
    player.ultimateTimer = Math.max(0, player.ultimateTimer - delta);
    if (!player.ultimateStruck && player.ultimateTimer <= ULTIMATE_STRIKE_AT) {
      player.ultimateStruck = true;
      this.hitStop = 0.13;
      this.shake = 7 * this.shakeScale;
      this.whiteFlash = this.flashes ? 1 : 0.16;
      for (const enemy of this.enemies) {
        if (!enemy.active || enemy.state === "dead" || Math.abs(enemy.x - player.x) > 330) continue;
        this.damageEnemy(enemy, enemy.kind === "boss" ? 96 : 120, 100, player.facing * 190, true, "ultimate");
      }
      for (let offset = -220; offset <= 220; offset += 44) {
        this.slashes.push({
          x: player.x + offset, y: 80 + seeded(offset) * 120, life: 0.34, maxLife: 0.34,
          radius: 74, facing: offset % 88 === 0 ? 1 : -1, angle: seeded(offset + 2) * 1.8 - 0.9,
          color: "#ffe69a", heavy: true,
        });
      }
    }
    if (player.ultimateTimer <= 0) {
      this.cinemaBars.classList.remove("is-visible");
      player.attackKind = "slash";
      player.dashCooldown = 0.18;
    }
  }

  private updateCamera(delta: number): void {
    this.targetCameraX = clamp(this.player.x - VIEW_WIDTH * 0.38, 0, WORLD_WIDTH - VIEW_WIDTH);
    if (this.bossTriggered && !this.bossDefeated) this.targetCameraX = clamp(this.targetCameraX, 4135, 5000);
    this.cameraX = lerp(this.cameraX, this.targetCameraX, 1 - Math.pow(0.001, delta));
    const verticalTarget = clamp((this.player.y - 150) * 0.14, -8, 8);
    this.cameraY = lerp(this.cameraY, verticalTarget, 1 - Math.pow(0.02, delta));
  }

  private checkTriggers(): void {
    if (!this.upgradeTriggered && this.player.x > 1980) {
      this.upgradeTriggered = true;
      this.state = "upgrade";
      this.input.reset();
      this.upgradeOverlay.classList.add("is-visible");
      this.audio.sfx("select");
      this.announce("日輪符の加護を選ぶ");
      return;
    }

    if (!this.helperTriggered && this.player.x > HELPER_TRIGGER_X) {
      this.triggerHelper();
      return;
    }

    if (!this.midStoryTriggered && this.player.x > 3300) {
      this.midStoryTriggered = true;
      this.showDialogue(
        [
          { speaker: "鈴霞の残響", text: "N……来ないで。あなたの護符は、記憶まで焼いてしまう。" },
          { speaker: "某美少女N", text: "声を覚えている。顔も覚えている。なら、まだ間に合う。" },
        ],
        () => { this.state = "playing"; },
      );
      return;
    }

    if (!this.bossTriggered && this.player.x > 4190) this.triggerBoss();
  }

  private triggerBoss(): void {
    this.bossTriggered = true;
    this.state = "cinematic";
    this.input.reset();
    this.bossIntroTimer = 2.65;
    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    if (boss) {
      boss.active = true;
      boss.state = "idle";
    }
    this.player.x = Math.max(this.player.x, 4240);
    this.player.vx = 0;
    if (this.helper.active) {
      this.helper.x = this.player.x - 62;
      this.helper.y = this.player.y;
      this.helper.state = "follow";
    }
    this.cameraX = 4160;
    this.cinemaBars.classList.add("is-visible");
    this.bossTitle.classList.add("is-visible");
    this.audio.setMode("boss");
    this.audio.sfx("boss");
    this.announce("緋月の剣巫　鈴霞");
  }

  private triggerHelper(): void {
    this.helperTriggered = true;
    this.helper = this.createHelper();
    this.helper.active = true;
    this.helper.state = "entrance";
    this.helper.stateTimer = 1.1;
    this.helper.x = this.player.x - 104;
    this.helper.y = this.player.y - 24;
    this.helper.facing = 1;
    this.helper.throwCooldown = 0.48;
    this.setSkillName("助っ人参戦・某ガジェオタG", 1.35);
    this.spawnBurst(this.helper.x, this.helper.y + 28, "#74e4df", 28, "spark");
    this.spawnBurst(this.helper.x, this.helper.y + 34, "#ffbd45", 18, "paper");
    this.addRing(this.helper.x, this.helper.y + 24, "#ffe69a", 42);
    this.audio.sfx("select");
    this.announce("助っ人、某ガジェオタG参戦。ガジェット支援を開始");
  }

  private updateHelper(delta: number): void {
    const helper = this.helper;
    if (!helper.active) return;
    const previousX = helper.x;

    helper.stateTimer = Math.max(0, helper.stateTimer - delta);
    helper.throwCooldown = Math.max(0, helper.throwCooldown - delta);
    helper.labelTimer = Math.max(0, helper.labelTimer - delta);

    const followX = this.player.x + this.player.w / 2 - this.player.facing * 58;
    const followY = this.player.y + (this.player.grounded ? 0 : 8);

    if (this.bossDefeated) {
      helper.state = "cheer";
      helper.stateTimer = Math.max(helper.stateTimer, 0.4);
      helper.x = lerp(helper.x, this.player.x - 50, 1 - Math.pow(0.025, delta));
      helper.y = lerp(helper.y, this.player.y, 1 - Math.pow(0.018, delta));
      helper.vx = delta > 0 ? (helper.x - previousX) / delta : 0;
      return;
    }

    if (helper.state === "entrance") {
      helper.x = lerp(helper.x, followX, 1 - Math.pow(0.002, delta));
      helper.y = lerp(helper.y, followY, 1 - Math.pow(0.002, delta));
      helper.facing = 1;
      helper.vx = delta > 0 ? (helper.x - previousX) / delta : 0;
      if (helper.stateTimer <= 0) helper.state = "follow";
      return;
    }

    helper.x = lerp(helper.x, followX, 1 - Math.pow(0.016, delta));
    helper.y = lerp(helper.y, followY, 1 - Math.pow(0.012, delta));
    helper.vx = delta > 0 ? (helper.x - previousX) / delta : 0;

    const target = this.nearestHelperTarget();
    if (target) helper.facing = target.x + target.w / 2 >= helper.x ? 1 : -1;
    else helper.facing = this.player.facing;

    if (helper.state === "throw" && helper.stateTimer <= 0) helper.state = "follow";
    if (helper.state === "follow" && helper.throwCooldown <= 0 && target) this.throwHelperGadget(target);
  }

  private nearestHelperTarget(): Enemy | undefined {
    return this.enemies
      .filter((enemy) => enemy.active && enemy.state !== "dead" && Math.abs(enemy.x - this.player.x) < 430)
      .sort((left, right) => Math.abs(left.x - this.helper.x) - Math.abs(right.x - this.helper.x))[0];
  }

  private throwHelperGadget(target: Enemy): void {
    const helper = this.helper;
    const frame = helper.gadgetCursor % 24;
    const originX = helper.x + helper.facing * 15;
    const originY = helper.y + 18;
    const targetX = target.x + target.w / 2;
    const targetY = target.y + target.h * 0.42;
    const dx = targetX - originX;
    const dy = targetY - originY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const speed = 210 + seeded(frame + this.elapsed * 3) * 28;

    this.projectiles.push({
      id: this.nextEntityId++,
      owner: "helper",
      kind: "gadget",
      x: originX,
      y: originY,
      vx: (dx / length) * speed,
      vy: (dy / length) * speed,
      w: 18,
      h: 18,
      life: 1.7,
      maxLife: 1.7,
      damage: target.kind === "boss" ? 2 : 3,
      angle: helper.facing > 0 ? -0.1 : Math.PI + 0.1,
      returning: false,
      hitIds: new Set(),
      gadgetFrame: frame,
    });

    helper.gadgetLabel = frame < 6
      ? "SEGA 16-BIT"
      : frame < 12
        ? "FAMICOM"
        : frame < 18
          ? "EVEN G2"
          : "MAC MINI";
    helper.labelTimer = 0.82;
    helper.gadgetCursor = (helper.gadgetCursor + 1) % 24;
    helper.throwCooldown = 0.68 + seeded(helper.gadgetCursor * 17 + this.elapsed) * 0.22;
    helper.state = "throw";
    helper.stateTimer = 0.27;
    this.spawnBurst(originX, originY, frame < 12 ? "#ffbd45" : "#74e4df", 6, "spark");
    this.audio.sfx("charm");
  }

  private updateCinematic(delta: number): void {
    this.bossIntroTimer -= delta;
    this.cameraX = lerp(this.cameraX, 4380, 1 - Math.pow(0.08, delta));
    if (this.bossIntroTimer <= 0) {
      this.state = "playing";
      this.bossTitle.classList.remove("is-visible");
      this.cinemaBars.classList.remove("is-visible");
      this.setSkillName("緋月契・開帳", 1);
    }
  }

  private updateProps(delta: number): void {
    for (const prop of this.props) prop.hitFlash = Math.max(0, prop.hitFlash - delta * 5);
  }

  private damageProp(prop: Prop): void {
    if (prop.broken) return;
    prop.hp -= 1;
    prop.hitFlash = 1;
    this.audio.sfx("break");
    this.spawnBurst(prop.x, prop.y - 12, prop.kind === "lantern" ? "#ff9c45" : "#8d7987", 9, "shard");
    if (prop.hp <= 0) {
      prop.broken = true;
      this.score += 35;
      this.spawnBurst(prop.x, prop.y - 12, "#ffbd45", 15, "paper");
    }
  }

  private updateEnemies(delta: number): void {
    const activationLeft = this.cameraX - 100;
    const activationRight = this.cameraX + VIEW_WIDTH + 150;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.x < activationLeft || enemy.x > activationRight) continue;
      enemy.invulnerable = Math.max(0, enemy.invulnerable - delta);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 6);

      if (enemy.state === "dead") {
        enemy.deathTimer -= delta;
        enemy.y -= delta * 7;
        continue;
      }

      if (enemy.state === "stagger") {
        enemy.stateTimer -= delta;
        enemy.vx *= Math.pow(0.02, delta);
        enemy.x += enemy.vx * delta;
        if (enemy.stateTimer <= 0) {
          enemy.state = "idle";
          enemy.actionCooldown = 0.38;
        }
        continue;
      }

      if (enemy.kind === "boss") this.updateBoss(enemy, delta);
      else if (enemy.kind === "bird") this.updateBird(enemy, delta);
      else if (enemy.kind === "hound") this.updateHound(enemy, delta);
      else this.updateLantern(enemy, delta);

      if (enemy.kind !== "bird") {
        enemy.x += enemy.vx * delta;
        enemy.vx *= Math.pow(0.08, delta);
        enemy.y = enemy.baseY;
      }
      enemy.x = clamp(enemy.x, 12, WORLD_WIDTH - enemy.w - 12);
    }
  }

  private updateLantern(enemy: Enemy, delta: number): void {
    const playerCenter = this.player.x + this.player.w / 2;
    const enemyCenter = enemy.x + enemy.w / 2;
    const direction = Math.sign(playerCenter - enemyCenter) || 1;
    const distance = Math.abs(playerCenter - enemyCenter);
    enemy.facing = direction as 1 | -1;
    enemy.actionCooldown -= delta;

    if (enemy.state === "telegraph") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "attack";
        enemy.stateTimer = 0.19;
        enemy.hitPlayer = false;
        enemy.vx = enemy.facing * 54;
      }
      return;
    }

    if (enemy.state === "attack") {
      enemy.stateTimer -= delta;
      if (!enemy.hitPlayer && enemy.stateTimer < 0.14) {
        enemy.hitPlayer = true;
        const hitX = enemy.facing > 0 ? enemy.x + enemy.w - 2 : enemy.x - 34;
        if (rectsOverlap(hitX, enemy.y + 5, 36, 29, this.player.x, this.player.y, this.player.w, this.player.h)) {
          this.damagePlayer(16, enemy.x + enemy.w / 2);
        }
      }
      if (enemy.stateTimer <= 0) {
        enemy.state = "recover";
        enemy.stateTimer = 0.42;
      }
      return;
    }

    if (enemy.state === "recover") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "idle";
        enemy.actionCooldown = 0.28 + seeded(enemy.id + this.elapsed) * 0.32;
      }
      return;
    }

    if (distance < 58 && enemy.actionCooldown <= 0) {
      enemy.state = "telegraph";
      enemy.stateTimer = 0.43;
      enemy.attackKind = "slash";
      enemy.vx = 0;
      this.audio.sfx("enemyCue");
      return;
    }
    if (distance < 270 && distance > 42) enemy.vx += direction * 165 * delta;
    enemy.vx = clamp(enemy.vx, -38, 38);
  }

  private updateHound(enemy: Enemy, delta: number): void {
    const playerCenter = this.player.x + this.player.w / 2;
    const enemyCenter = enemy.x + enemy.w / 2;
    const direction = Math.sign(playerCenter - enemyCenter) || 1;
    const distance = Math.abs(playerCenter - enemyCenter);
    enemy.facing = direction as 1 | -1;
    enemy.actionCooldown -= delta;

    if (enemy.state === "telegraph") {
      enemy.stateTimer -= delta;
      enemy.vx = -enemy.facing * 14;
      if (enemy.stateTimer <= 0) {
        enemy.state = "dash";
        enemy.stateTimer = 0.37;
        enemy.hitPlayer = false;
        enemy.vx = enemy.facing * 210;
      }
      return;
    }

    if (enemy.state === "dash") {
      enemy.stateTimer -= delta;
      enemy.vx = enemy.facing * 210;
      if (!enemy.hitPlayer && rectsOverlap(enemy.x, enemy.y + 4, enemy.w, enemy.h - 4, this.player.x, this.player.y, this.player.w, this.player.h)) {
        enemy.hitPlayer = true;
        this.damagePlayer(18, enemy.x + enemy.w / 2);
      }
      if (Math.floor(enemy.stateTimer * 70) % 3 === 0) this.spawnDust(enemy.x + enemy.w / 2, enemy.y + enemy.h, 1, "#6d4257");
      if (enemy.stateTimer <= 0) {
        enemy.state = "recover";
        enemy.stateTimer = 0.48;
      }
      return;
    }

    if (enemy.state === "recover") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "idle";
        enemy.actionCooldown = 0.62;
      }
      return;
    }

    if (distance < 145 && enemy.actionCooldown <= 0) {
      enemy.state = "telegraph";
      enemy.stateTimer = 0.38;
      enemy.attackKind = "lunge";
      this.audio.sfx("enemyCue");
      return;
    }
    if (distance < 310 && distance > 95) enemy.vx += direction * 205 * delta;
    enemy.vx = clamp(enemy.vx, -52, 52);
  }

  private updateBird(enemy: Enemy, delta: number): void {
    const playerCenter = this.player.x + this.player.w / 2;
    const enemyCenter = enemy.x + enemy.w / 2;
    const direction = Math.sign(playerCenter - enemyCenter) || 1;
    enemy.facing = direction as 1 | -1;
    enemy.y = enemy.baseY + Math.sin(this.elapsed * 3.4 + enemy.id) * 7;
    enemy.actionCooldown -= delta;

    if (enemy.state === "telegraph") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "attack";
        enemy.stateTimer = 0.18;
        const originX = enemy.x + enemy.w / 2;
        const originY = enemy.y + enemy.h / 2;
        const dx = this.player.x + this.player.w / 2 - originX;
        const dy = this.player.y + this.player.h / 2 - originY;
        const length = Math.max(1, Math.hypot(dx, dy));
        this.projectiles.push({
          id: this.nextEntityId++, owner: "enemy", kind: "feather", x: originX, y: originY,
          vx: (dx / length) * 135, vy: (dy / length) * 135, w: 10, h: 5, life: 2.8, maxLife: 2.8,
          damage: 12, angle: Math.atan2(dy, dx), returning: false, hitIds: new Set(),
        });
      }
      return;
    }

    if (enemy.state === "attack") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "recover";
        enemy.stateTimer = 0.38;
      }
      return;
    }

    if (enemy.state === "recover") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "idle";
        enemy.actionCooldown = 1.2 + seeded(enemy.id + this.elapsed) * 0.7;
      }
      return;
    }

    if (Math.abs(playerCenter - enemyCenter) < 350 && enemy.actionCooldown <= 0) {
      enemy.state = "telegraph";
      enemy.stateTimer = 0.5;
      enemy.attackKind = "shot";
      this.audio.sfx("enemyCue");
    }
  }

  private updateBoss(enemy: Enemy, delta: number): void {
    if (enemy.hp <= enemy.maxHp * 0.52 && enemy.phase === 1) {
      enemy.phase = 2;
      enemy.state = "stagger";
      enemy.stateTimer = 0.82;
      enemy.poise = 0;
      this.whiteFlash = this.flashes ? 0.55 : 0.1;
      this.shake = 5 * this.shakeScale;
      this.setSkillName("緋月契・第二相", 1.3);
      this.audio.sfx("boss");
      this.spawnBurst(enemy.x + enemy.w / 2, enemy.y + 20, "#d7475e", 42, "paper");
      return;
    }

    const playerCenter = this.player.x + this.player.w / 2;
    const enemyCenter = enemy.x + enemy.w / 2;
    const direction = Math.sign(playerCenter - enemyCenter) || 1;
    const distance = Math.abs(playerCenter - enemyCenter);
    enemy.facing = direction as 1 | -1;
    enemy.actionCooldown -= delta;

    if (enemy.state === "telegraph") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) this.beginBossAttack(enemy);
      return;
    }

    if (enemy.state === "attack") {
      enemy.stateTimer -= delta;
      this.resolveBossAttack(enemy);
      if (enemy.stateTimer <= 0) {
        enemy.state = "recover";
        enemy.stateTimer = enemy.phase === 2 ? 0.28 : 0.42;
      }
      return;
    }

    if (enemy.state === "dash") {
      enemy.stateTimer -= delta;
      enemy.vx = enemy.facing * (enemy.phase === 2 ? 315 : 255);
      if (!enemy.hitPlayer && rectsOverlap(enemy.x - 8, enemy.y, enemy.w + 16, enemy.h, this.player.x, this.player.y, this.player.w, this.player.h)) {
        enemy.hitPlayer = true;
        this.damagePlayer(enemy.phase === 2 ? 24 : 20, enemy.x + enemy.w / 2);
      }
      if (Math.floor(enemy.stateTimer * 85) % 2 === 0) this.spawnEnemyAfterimage(enemy);
      if (enemy.stateTimer <= 0) {
        enemy.state = "recover";
        enemy.stateTimer = 0.32;
      }
      return;
    }

    if (enemy.state === "recover") {
      enemy.stateTimer -= delta;
      if (enemy.stateTimer <= 0) {
        enemy.state = "idle";
        enemy.actionCooldown = enemy.phase === 2 ? 0.22 : 0.4;
      }
      return;
    }

    if (enemy.actionCooldown <= 0) {
      const pattern = Math.floor((this.runTime * 1.7 + enemy.id) % (enemy.phase === 2 ? 5 : 3));
      enemy.attackKind = pattern === 0 ? "slash" : pattern === 1 ? "lunge" : pattern === 2 ? "wave" : pattern === 3 ? "rain" : "cross";
      enemy.state = "telegraph";
      enemy.stateTimer = enemy.attackKind === "rain" ? 0.68 : enemy.attackKind === "lunge" ? 0.42 : 0.5;
      enemy.hitPlayer = false;
      enemy.vx = 0;
      this.audio.sfx("enemyCue");
      return;
    }

    if (distance > 92) enemy.vx += direction * 290 * delta;
    else if (distance < 58) enemy.vx -= direction * 180 * delta;
    enemy.vx = clamp(enemy.vx, -62, 62);
  }

  private beginBossAttack(enemy: Enemy): void {
    enemy.hitPlayer = false;
    if (enemy.attackKind === "lunge") {
      enemy.state = "dash";
      enemy.stateTimer = enemy.phase === 2 ? 0.34 : 0.42;
      enemy.vx = enemy.facing * 280;
      this.setSkillName("紅蓮・縮地", 0.55);
      return;
    }

    enemy.state = "attack";
    enemy.stateTimer = enemy.attackKind === "rain" ? 0.72 : enemy.attackKind === "cross" ? 0.55 : 0.36;
    if (enemy.attackKind === "wave") {
      this.setSkillName("緋月輪", 0.62);
      for (const offset of [-0.25, 0, 0.25]) {
        const speed = 175;
        this.projectiles.push({
          id: this.nextEntityId++, owner: "enemy", kind: "wave", x: enemy.x + enemy.w / 2, y: enemy.y + 17,
          vx: enemy.facing * Math.cos(offset) * speed, vy: Math.sin(offset) * speed, w: 18, h: 29,
          life: 2.2, maxLife: 2.2, damage: 16, angle: offset, returning: false, hitIds: new Set(),
        });
      }
    } else if (enemy.attackKind === "rain") {
      this.setSkillName("血札・天葬", 0.7);
      for (let index = 0; index < 8; index += 1) {
        const x = clamp(this.player.x - 120 + index * 36 + seeded(index + this.runTime) * 20, 4250, 5230);
        this.projectiles.push({
          id: this.nextEntityId++, owner: "enemy", kind: "seal", x, y: -30 - index * 10,
          vx: 0, vy: 0, w: 11, h: 25, life: 2.1 + index * 0.035, maxLife: 2.1 + index * 0.035,
          damage: 14, angle: 0, returning: false, hitIds: new Set(),
        });
      }
    } else if (enemy.attackKind === "cross") {
      this.setSkillName("双誓・血霞", 0.62);
      this.slashes.push({ x: enemy.x, y: enemy.y + 18, life: 0.32, maxLife: 0.32, radius: 62, facing: enemy.facing, angle: 0.65, color: "#d7475e", heavy: true });
      this.slashes.push({ x: enemy.x, y: enemy.y + 18, life: 0.32, maxLife: 0.32, radius: 62, facing: enemy.facing, angle: -0.65, color: "#d7475e", heavy: true });
    } else {
      this.setSkillName("緋月・三連", 0.48);
      this.slashes.push({ x: enemy.x, y: enemy.y + 19, life: 0.28, maxLife: 0.28, radius: 52, facing: enemy.facing, angle: 0.45, color: "#d7475e", heavy: true });
    }
  }

  private resolveBossAttack(enemy: Enemy): void {
    if (enemy.hitPlayer) return;
    if (enemy.attackKind === "wave" || enemy.attackKind === "rain") {
      enemy.hitPlayer = true;
      return;
    }
    const active = enemy.stateTimer < (enemy.attackKind === "cross" ? 0.37 : 0.25);
    if (!active) return;
    const range = enemy.attackKind === "cross" ? 76 : 56;
    const hitX = enemy.facing > 0 ? enemy.x + enemy.w - 4 : enemy.x - range + 4;
    if (rectsOverlap(hitX, enemy.y - 3, range, enemy.h + 6, this.player.x, this.player.y, this.player.w, this.player.h)) {
      enemy.hitPlayer = true;
      this.damagePlayer(enemy.attackKind === "cross" ? 26 : 20, enemy.x + enemy.w / 2);
    }
  }

  private damageEnemy(
    enemy: Enemy,
    damage: number,
    poise: number,
    knockback: number,
    critical: boolean,
    source: DamageSource = "player",
  ): void {
    if (enemy.state === "dead" || enemy.invulnerable > 0) return;

    const appliedDamage = source === "helper"
      ? Math.max(0, Math.min(damage, enemy.hp - 1))
      : Math.min(damage, enemy.hp);
    if (appliedDamage <= 0) return;

    enemy.hp = Math.max(0, enemy.hp - appliedDamage);
    if (source === "helper") {
      enemy.hitFlash = Math.max(enemy.hitFlash, 0.45);
      enemy.vx += Math.sign(knockback || 1) * 3;
      this.damageNumbers.push({
        x: enemy.x + enemy.w / 2,
        y: enemy.y - 2,
        value: appliedDamage,
        life: 0.52,
        critical: false,
      });
      this.spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.42, "#74e4df", 5, "spark");
      return;
    }

    enemy.poise += poise;
    enemy.vx += knockback;
    enemy.hitFlash = 1;
    enemy.invulnerable = 0.035;
    this.combo += 1;
    this.comboTimer = 1.45;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += appliedDamage * 7 + this.combo * 5 + (critical ? 80 : 0);
    this.damageNumbers.push({ x: enemy.x + enemy.w / 2, y: enemy.y - 5, value: appliedDamage, life: 0.72, critical });
    this.spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, critical ? "#ffe69a" : "#ef8a73", critical ? 18 : 9, "spark");
    this.slashes.push({
      x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, life: critical ? 0.18 : 0.11, maxLife: critical ? 0.18 : 0.11,
      radius: critical ? 32 : 20, facing: knockback >= 0 ? 1 : -1, angle: seeded(enemy.id + this.elapsed) - 0.5,
      color: critical ? "#fff1bb" : "#f7b6a0", heavy: critical,
    });
    this.hitStop = Math.max(this.hitStop, critical ? 0.082 : 0.043);
    this.shake = Math.max(this.shake, (critical ? 4.2 : 2) * this.shakeScale);
    this.whiteFlash = this.flashes ? Math.max(this.whiteFlash, critical ? 0.27 : 0.09) : 0;
    this.audio.sfx(enemy.hp <= 0 ? "kill" : "hit");
    if (source === "player") this.chargeUltimate();

    if (enemy.hp <= 0) {
      enemy.state = "dead";
      enemy.deathTimer = enemy.kind === "boss" ? 2.4 : 0.75;
      enemy.vx = knockback * 1.2;
      this.score += enemy.kind === "boss" ? 5000 : 420;
      this.spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.kind === "boss" ? "#ffbd45" : "#d7475e", enemy.kind === "boss" ? 80 : 30, "paper");
      if (enemy.kind === "boss" && !this.bossDefeated) this.onBossDefeated(enemy);
      return;
    }

    if (enemy.poise >= enemy.maxPoise) {
      enemy.poise = 0;
      enemy.state = "stagger";
      enemy.stateTimer = enemy.kind === "boss" ? 0.56 : 0.74;
      this.setSkillName("崩し", 0.45);
      this.addRing(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffbd45", 35);
      this.score += 170;
    }
  }

  private onBossDefeated(enemy: Enemy): void {
    this.bossDefeated = true;
    this.victoryCountdown = 2.7;
    this.player.invulnerable = 5;
    this.player.vx = 0;
    if (this.helper.active) {
      this.helper.state = "cheer";
      this.helper.stateTimer = 3;
    }
    this.hitStop = 0.16;
    this.shake = 7 * this.shakeScale;
    this.whiteFlash = this.flashes ? 1 : 0.15;
    this.cinemaBars.classList.add("is-visible");
    this.setSkillName("終ノ太刀・朝凪", 2.2);
    this.audio.setMode("victory");
    this.audio.sfx("victory");
    for (let index = 0; index < 6; index += 1) {
      window.setTimeout(() => {
        this.spawnBurst(enemy.x + seeded(index) * 50 - 12, enemy.y + seeded(index + 4) * 44, "#ffbd45", 20, "paper");
      }, index * 170);
    }
  }

  private damagePlayer(damage: number, sourceX: number): void {
    const player = this.player;
    if (player.invulnerable > 0 || this.state !== "playing") {
      if (player.dashTimer > 0 && this.goldenTime <= 0.02) this.triggerPerfectDodge();
      return;
    }
    player.hp = Math.max(0, player.hp - damage);
    player.invulnerable = 0.9;
    player.hurtTimer = 0.36;
    player.vx = Math.sign(player.x - sourceX || 1) * 142;
    player.vy = -105;
    player.attackTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.hitsTaken += 1;
    this.redFlash = this.flashes ? 0.42 : 0.12;
    this.shake = 4 * this.shakeScale;
    this.hitStop = 0.07;
    this.audio.sfx("hurt");
    this.spawnBurst(player.x + player.w / 2, player.y + 17, "#d7475e", 16, "paper");
    this.announce(`被弾　残り体力 ${player.hp}`);

    if (player.hp <= 0) {
      this.state = "dead";
      this.deathTimer = 1.65;
      this.cinemaBars.classList.add("is-visible");
      this.setSkillName("九命・ひとつ散る", 1.3);
      this.spawnBurst(player.x + player.w / 2, player.y + 17, "#ffbd45", 42, "ember");
    }
  }

  private respawn(): void {
    const lives = Math.max(1, this.player.lives - 1);
    const upgrade = this.upgrade;
    const respawnX = this.bossTriggered ? 4240 : this.checkpointX;
    this.player = this.createPlayer();
    this.player.lives = lives;
    this.player.x = respawnX;
    this.player.y = GROUND_Y - this.player.h;
    this.player.previousY = this.player.y;
    this.player.grounded = true;
    this.player.invulnerable = 1.2;
    this.upgrade = upgrade;
    this.helper = this.createHelper();
    if (this.helperTriggered) {
      this.helper.active = true;
      this.helper.state = "follow";
      this.helper.x = this.player.x - 58;
      this.helper.y = this.player.y;
    }
    this.projectiles = [];
    this.enemies = this.createEnemies();
    if (this.bossTriggered) {
      const boss = this.enemies.find((enemy) => enemy.kind === "boss");
      if (boss) boss.active = true;
      this.checkpointX = 4240;
      this.audio.setMode("boss");
    } else {
      this.audio.setMode("explore");
    }
    this.cameraX = clamp(this.player.x - 120, 0, WORLD_WIDTH - VIEW_WIDTH);
    this.cinemaBars.classList.remove("is-visible");
    this.state = "playing";
    this.input.reset();
    this.syncUltimateUi();
    this.announce(`猫の命、残り ${lives}`);
  }

  private updateProjectiles(delta: number): void {
    for (const projectile of this.projectiles) {
      projectile.life -= delta;
      projectile.angle += delta * (projectile.kind === "charm" ? 12 : projectile.kind === "gadget" ? 10 : 5);

      if (projectile.kind === "charm" && projectile.life < 0.66) {
        projectile.returning = true;
        const dx = this.player.x + this.player.w / 2 - projectile.x;
        const dy = this.player.y + 15 - projectile.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        projectile.vx = (dx / length) * 245;
        projectile.vy = (dy / length) * 245;
        if (length < 15) projectile.life = 0;
      } else if (projectile.kind === "seal") {
        if (projectile.life < projectile.maxLife - 0.6) projectile.vy = Math.min(310, projectile.vy + 520 * delta);
      }

      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;

      if (projectile.owner === "enemy") this.resolveHostileProjectile(projectile);
      else this.resolveFriendlyProjectile(projectile);
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -100 && projectile.x < WORLD_WIDTH + 100 && projectile.y < 380);
  }

  private resolveFriendlyProjectile(projectile: Projectile): void {
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.state === "dead" || projectile.hitIds.has(enemy.id)) continue;
      if (!rectsOverlap(projectile.x - projectile.w / 2, projectile.y - projectile.h / 2, projectile.w, projectile.h, enemy.x, enemy.y, enemy.w, enemy.h)) continue;
      projectile.hitIds.add(enemy.id);
      const critical = projectile.kind === "moon";
      const source: DamageSource = projectile.owner === "helper" ? "helper" : "player";
      this.damageEnemy(
        enemy,
        projectile.damage,
        source === "helper" ? 0 : critical ? 20 : 10,
        Math.sign(projectile.vx) * (source === "helper" ? 2 : 45),
        critical,
        source,
      );
      if (projectile.kind === "charm" && projectile.owner === "player") enemy.vx -= Math.sign(projectile.vx) * 70;
      if (projectile.kind !== "charm") projectile.life = 0;
    }
  }

  private resolveHostileProjectile(projectile: Projectile): void {
    const telegraphingSeal = projectile.kind === "seal" && projectile.vy === 0;
    if (telegraphingSeal) return;
    if (rectsOverlap(projectile.x - projectile.w / 2, projectile.y - projectile.h / 2, projectile.w, projectile.h, this.player.x, this.player.y, this.player.w, this.player.h)) {
      projectile.life = 0;
      this.damagePlayer(projectile.damage, projectile.x);
    }
    if (projectile.y + projectile.h / 2 >= GROUND_Y && projectile.kind === "seal") {
      projectile.life = 0;
      this.spawnBurst(projectile.x, GROUND_Y, "#d7475e", 12, "paper");
      this.shake = Math.max(this.shake, 1.4 * this.shakeScale);
    }
  }

  private updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.life -= delta;
      particle.vy += particle.gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.rotation += particle.spin * delta;
      particle.vx *= Math.pow(0.12, delta);
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const slash of this.slashes) slash.life -= delta;
    this.slashes = this.slashes.filter((slash) => slash.life > 0);

    for (const image of this.afterimages) image.life -= delta;
    this.afterimages = this.afterimages.filter((image) => image.life > 0);

    for (const number of this.damageNumbers) {
      number.life -= delta;
      number.y -= delta * 22;
    }
    this.damageNumbers = this.damageNumbers.filter((number) => number.life > 0);
  }

  private spawnBurst(x: number, y: number, color: string, count: number, kind: ParticleKind): void {
    for (let index = 0; index < count; index += 1) {
      const angle = seeded(this.nextEntityId + index + this.elapsed * 41) * Math.PI * 2;
      const speed = 25 + seeded(this.nextEntityId + index + 9) * (kind === "paper" ? 125 : 95);
      const life = 0.28 + seeded(this.nextEntityId + index + 17) * (kind === "paper" ? 0.85 : 0.5);
      this.particles.push({
        kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (kind === "ember" ? 45 : 0),
        life, maxLife: life, size: 1 + seeded(index + this.nextEntityId) * (kind === "paper" ? 4 : 2.5),
        color, gravity: kind === "spark" ? 120 : kind === "ember" ? -28 : 75,
        rotation: angle, spin: (seeded(index + 32) - 0.5) * 11,
      });
    }
    this.nextEntityId += count;
  }

  private spawnDust(x: number, y: number, count: number, color: string): void {
    for (let index = 0; index < count; index += 1) {
      const life = 0.22 + seeded(index + this.elapsed * 90) * 0.24;
      this.particles.push({
        kind: "dust", x: x + (seeded(index + 2) - 0.5) * 15, y: y - 2,
        vx: (seeded(index + 4) - 0.5) * 34, vy: -8 - seeded(index + 5) * 22,
        life, maxLife: life, size: 2 + seeded(index + 3) * 3, color, gravity: -4,
        rotation: 0, spin: 0,
      });
    }
  }

  private addRing(x: number, y: number, color: string, radius: number): void {
    this.slashes.push({ x, y, life: 0.28, maxLife: 0.28, radius, facing: 1, angle: Math.PI, color, heavy: true });
  }

  private spawnAfterimage(color: string): void {
    const player = this.player;
    const previous = this.afterimages[this.afterimages.length - 1];
    if (previous && Math.abs(previous.x - player.x) < 8 && previous.life > 0.16) return;
    this.afterimages.push({ x: player.x, y: player.y, facing: player.facing, life: 0.25, maxLife: 0.25, pose: player.attackStep, color });
    if (this.upgrade === "fire") {
      const recentEmber = this.projectiles.find((projectile) => projectile.kind === "ember" && Math.abs(projectile.x - player.x) < 18);
      if (!recentEmber) {
        this.projectiles.push({
          id: this.nextEntityId++, owner: "player", kind: "ember", x: player.x + player.w / 2, y: player.y + player.h - 5,
          vx: 0, vy: 0, w: 20, h: 28, life: 0.85, maxLife: 0.85, damage: 12,
          angle: 0, returning: false, hitIds: new Set(),
        });
      }
    }
  }

  private spawnEnemyAfterimage(enemy: Enemy): void {
    this.afterimages.push({ x: enemy.x, y: enemy.y, facing: enemy.facing, life: 0.2, maxLife: 0.2, pose: -1, color: "#d7475e" });
  }

  private showDialogue(lines: DialogueLine[], onDone: () => void): void {
    this.dialogue = lines;
    this.dialogueIndex = 0;
    this.dialogueTyped = 0;
    this.dialogueOnDone = onDone;
    this.state = "story";
    this.storyOverlay.classList.add("is-visible");
    this.updateDialogueText();
    this.input.reset();
  }

  private updateDialogue(delta: number): void {
    const line = this.dialogue[this.dialogueIndex];
    if (!line) return;
    this.dialogueTyped = Math.min(line.text.length, this.dialogueTyped + delta * 42);
    this.storyText.textContent = line.text.slice(0, Math.floor(this.dialogueTyped));
    this.storyHint.textContent = this.dialogueTyped >= line.text.length ? "決定して進む" : "";
  }

  private advanceDialogue(): void {
    if (this.state !== "story") return;
    const line = this.dialogue[this.dialogueIndex];
    if (!line) return;
    if (this.dialogueTyped < line.text.length) {
      this.dialogueTyped = line.text.length;
      this.updateDialogueText();
      return;
    }
    this.dialogueIndex += 1;
    this.audio.sfx("select");
    if (this.dialogueIndex >= this.dialogue.length) {
      this.storyOverlay.classList.remove("is-visible");
      const done = this.dialogueOnDone;
      this.dialogueOnDone = null;
      done?.();
      this.input.reset();
      return;
    }
    this.dialogueTyped = 0;
    this.updateDialogueText();
  }

  private updateDialogueText(): void {
    const line = this.dialogue[this.dialogueIndex];
    if (!line) return;
    this.storySpeaker.textContent = line.speaker;
    this.storyText.textContent = line.text.slice(0, Math.floor(this.dialogueTyped));
    this.storyHint.textContent = this.dialogueTyped >= line.text.length ? "決定して進む" : "";
    this.announce(`${line.speaker}：${line.text}`);
  }

  private setSkillName(name: string, duration: number): void {
    this.skillName = name;
    this.skillNameTimer = duration;
  }

  private chargeUltimate(): void {
    const before = this.player.focus;
    this.player.focus = Math.min(ULTIMATE_HITS_REQUIRED, this.player.focus + 1);
    this.syncUltimateUi();
    if (this.player.focus === before) return;

    if (this.player.focus >= ULTIMATE_HITS_REQUIRED) {
      this.setSkillName("GMK READY", 1.05);
      this.addRing(this.player.x + this.player.w / 2, this.player.y + 18, "#ffe69a", 38);
      this.spawnBurst(this.player.x + this.player.w / 2, this.player.y + 17, "#ffbd45", 20, "spark");
      this.audio.sfx("select");
      this.announce("GMK準備完了。必殺技を発動できます");
    } else {
      this.announce(`GMK充填 ${this.player.focus}/${ULTIMATE_HITS_REQUIRED}`);
    }
  }

  private syncUltimateUi(): void {
    const ready = this.player.focus >= ULTIMATE_HITS_REQUIRED;
    this.ultimateButton?.classList.toggle("is-ready", ready);
    if (this.ultimateTouchCount) {
      this.ultimateTouchCount.textContent = ready ? "READY" : `${this.player.focus}/${ULTIMATE_HITS_REQUIRED}`;
    }
    if (this.ultimateButton) {
      this.ultimateButton.setAttribute(
        "aria-label",
        ready ? "必殺技GMK、発動可能" : `必殺技GMK、充填${this.player.focus}/${ULTIMATE_HITS_REQUIRED}`,
      );
    }
  }

  private announce(message: string): void {
    this.ariaLive.textContent = message;
  }

  private showResults(): void {
    this.state = "victory";
    this.input.reset();
    this.cinemaBars.classList.remove("is-visible");
    this.resultsOverlay.classList.add("is-visible");
    const timeBonus = Math.max(0, Math.floor(36000 - this.runTime * 80));
    const noHitBonus = Math.max(0, 12000 - this.hitsTaken * 1800);
    const finalScore = Math.floor(this.score + timeBonus + noHitBonus + this.perfectDodges * 700);
    const rank = finalScore >= 42000 ? "天" : finalScore >= 33000 ? "星" : finalScore >= 25000 ? "月" : finalScore >= 17000 ? "牙" : "爪";
    const minutes = Math.floor(this.runTime / 60).toString().padStart(2, "0");
    const seconds = Math.floor(this.runTime % 60).toString().padStart(2, "0");
    element("result-rank").textContent = rank;
    element("result-time").textContent = `${minutes}:${seconds}`;
    element("result-combo").textContent = String(this.maxCombo);
    element("result-dodges").textContent = String(this.perfectDodges);
    element("result-score").textContent = finalScore.toLocaleString("ja-JP");
    const previousBest = Number(localStorage.getItem("bishoujo-n-best") ?? 0);
    const best = Math.max(previousBest, finalScore);
    localStorage.setItem("bishoujo-n-best", String(best));
    element("best-score").textContent = finalScore > previousBest ? `最高記録更新　${best.toLocaleString("ja-JP")}` : `最高記録　${best.toLocaleString("ja-JP")}`;
    this.announce(`第一夜踏破。評価${rank}、得点${finalScore}`);
  }

  private render(): void {
    const context = this.context;
    const renderScale = context.canvas.width / VIEW_WIDTH;
    context.save();
    context.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    context.imageSmoothingEnabled = false;
    this.drawBackground(context);

    const shakeX = this.shake > 0 ? (seeded(this.elapsed * 321) - 0.5) * this.shake * 2 : 0;
    const shakeY = this.shake > 0 ? (seeded(this.elapsed * 517 + 3) - 0.5) * this.shake * 1.3 : 0;
    context.save();
    context.translate(Math.round(shakeX), Math.round(shakeY - this.cameraY));
    this.drawPlatforms(context);
    this.drawWorldArchitecture(context);
    this.drawProps(context);
    this.drawAfterimages(context);
    this.drawProjectiles(context);
    this.drawEnemies(context);
    this.drawHelper(context);
    this.drawPlayer(context);
    this.drawSlashes(context);
    this.drawParticles(context);
    this.drawDamageNumbers(context);
    context.restore();

    if (this.state !== "idle") this.drawHud(context);
    this.drawTechniqueBanner(context);
    this.drawTutorialPrompts(context);
    this.drawUltimateOverlay(context);
    this.drawScreenEffects(context);
    context.restore();
  }

  private drawBackground(context: CanvasRenderingContext2D): void {
    const dawn = this.dawn;
    if (imageReady(this.backgroundPlate)) {
      const driftX = -21.5 + Math.sin(this.cameraX * 0.0012) * 7.5;
      const driftY = -12 + Math.sin(this.cameraX * 0.0007 + 1.4) * 4;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.backgroundPlate, driftX, driftY, 509, 286);

      // Keep the generated night plate readable while letting the ending recover into dawn.
      context.fillStyle = "rgba(8, 3, 13, 0.14)";
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      if (dawn > 0) {
        const morning = context.createLinearGradient(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        morning.addColorStop(0, `rgba(33, 104, 117, ${dawn * 0.3})`);
        morning.addColorStop(0.46, `rgba(255, 180, 103, ${dawn * 0.2})`);
        morning.addColorStop(1, `rgba(255, 219, 145, ${dawn * 0.48})`);
        context.globalCompositeOperation = "screen";
        context.fillStyle = morning;
        context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        const sun = context.createRadialGradient(405, 48, 0, 405, 48, 250);
        sun.addColorStop(0, `rgba(255, 243, 188, ${dawn * 0.42})`);
        sun.addColorStop(1, "rgba(255, 180, 96, 0)");
        context.fillStyle = sun;
        context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      }
      context.globalCompositeOperation = "source-over";

      const rainOpacity = (1 - dawn) * 0.34;
      context.strokeStyle = `rgba(172, 224, 225, ${rainOpacity})`;
      context.lineWidth = 0.72;
      context.beginPath();
      for (let index = 0; index < 62; index += 1) {
        const speed = 105 + seeded(index + 23) * 148;
        const x = ((index * 73 + this.elapsed * speed * 0.34) % (VIEW_WIDTH + 120)) - 60;
        const y = ((index * 37 + this.elapsed * speed) % (VIEW_HEIGHT + 80)) - 40;
        const length = 4 + seeded(index + 7) * 9;
        context.moveTo(Math.floor(x), Math.floor(y));
        context.lineTo(Math.floor(x - length * 0.38), Math.floor(y + length));
      }
      context.stroke();

      const vignette = context.createRadialGradient(240, 142, 74, 240, 142, 300);
      vignette.addColorStop(0, "rgba(4, 1, 7, 0)");
      vignette.addColorStop(1, `rgba(3, 1, 7, ${0.36 - dawn * 0.2})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      context.restore();
      return;
    }

    const sky = context.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    sky.addColorStop(0, `rgb(${Math.round(lerp(8, 28, dawn))}, ${Math.round(lerp(8, 49, dawn))}, ${Math.round(lerp(19, 68, dawn))})`);
    sky.addColorStop(0.62, `rgb(${Math.round(lerp(30, 129, dawn))}, ${Math.round(lerp(15, 77, dawn))}, ${Math.round(lerp(39, 83, dawn))})`);
    sky.addColorStop(1, `rgb(${Math.round(lerp(48, 229, dawn))}, ${Math.round(lerp(22, 146, dawn))}, ${Math.round(lerp(42, 86, dawn))})`);
    context.fillStyle = sky;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    for (let index = 0; index < 38; index += 1) {
      const x = seeded(index) * VIEW_WIDTH;
      const y = seeded(index + 83) * 128;
      const flicker = 0.32 + Math.sin(this.elapsed * (1 + seeded(index + 4) * 2) + index) * 0.18;
      context.globalAlpha = flicker * (1 - dawn);
      context.fillStyle = index % 7 === 0 ? "#79d8d0" : "#f5d7b0";
      context.fillRect(Math.floor(x), Math.floor(y), index % 6 === 0 ? 2 : 1, 1);
    }
    context.globalAlpha = 1;

    const moonX = 380 - this.cameraX * 0.032;
    const moonY = 63 - this.cameraY * 0.1;
    const moonGlow = context.createRadialGradient(moonX, moonY, 21, moonX, moonY, 68);
    moonGlow.addColorStop(0, `rgba(222, 59, 72, ${0.46 * (1 - dawn)})`);
    moonGlow.addColorStop(0.55, `rgba(177, 40, 65, ${0.18 * (1 - dawn)})`);
    moonGlow.addColorStop(1, "rgba(126, 32, 56, 0)");
    context.fillStyle = moonGlow;
    context.fillRect(moonX - 72, moonY - 72, 144, 144);
    context.fillStyle = `rgba(${Math.round(lerp(199, 255, dawn))}, ${Math.round(lerp(50, 184, dawn))}, ${Math.round(lerp(70, 128, dawn))}, ${lerp(0.9, 0.45, dawn)})`;
    context.beginPath();
    context.arc(moonX, moonY, 39, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.22 * (1 - dawn);
    context.fillStyle = "#451c36";
    for (let index = 0; index < 7; index += 1) {
      context.beginPath();
      context.arc(moonX - 19 + seeded(index) * 37, moonY - 19 + seeded(index + 10) * 37, 3 + seeded(index + 30) * 8, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    if (dawn > 0) {
      const rays = context.createRadialGradient(425, 36, 0, 425, 36, 270);
      rays.addColorStop(0, `rgba(255, 230, 157, ${dawn * 0.34})`);
      rays.addColorStop(1, "rgba(255, 180, 120, 0)");
      context.fillStyle = rays;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    this.drawMountainLayer(context, 0.055, 143, 31, dawn > 0.3 ? "#30465a" : "#17152a");
    this.drawMountainLayer(context, 0.09, 168, 24, dawn > 0.3 ? "#263848" : "#121021");
    this.drawCityLayer(context, 0.14, 167, 0.42);
    this.drawCityLayer(context, 0.24, 190, 0.68);

    const rainOpacity = (1 - dawn) * 0.31;
    context.save();
    context.strokeStyle = `rgba(151, 210, 216, ${rainOpacity})`;
    context.lineWidth = 1;
    context.beginPath();
    for (let index = 0; index < 72; index += 1) {
      const speed = 92 + seeded(index + 23) * 120;
      const x = ((index * 73 + this.elapsed * speed * 0.34) % (VIEW_WIDTH + 120)) - 60;
      const y = ((index * 37 + this.elapsed * speed) % (VIEW_HEIGHT + 80)) - 40;
      const length = 4 + seeded(index + 7) * 8;
      context.moveTo(Math.floor(x), Math.floor(y));
      context.lineTo(Math.floor(x - length * 0.38), Math.floor(y + length));
    }
    context.stroke();
    context.restore();

    context.globalAlpha = 0.18 + dawn * 0.1;
    context.fillStyle = dawn > 0.4 ? "#d99b72" : "#281d35";
    context.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
    context.globalAlpha = 1;
  }

  private drawMountainLayer(context: CanvasRenderingContext2D, factor: number, baseY: number, amplitude: number, color: string): void {
    const offset = -((this.cameraX * factor) % 110);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, VIEW_HEIGHT);
    context.lineTo(offset - 110, baseY);
    for (let index = -1; index < 7; index += 1) {
      const x = offset + index * 110;
      context.lineTo(x, baseY);
      context.lineTo(x + 34, baseY - amplitude * (0.6 + seeded(index + 41) * 0.7));
      context.lineTo(x + 70, baseY - amplitude * (0.2 + seeded(index + 57) * 0.3));
      context.lineTo(x + 110, baseY);
    }
    context.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    context.closePath();
    context.fill();
  }

  private drawCityLayer(context: CanvasRenderingContext2D, factor: number, baseY: number, opacity: number): void {
    const span = 78;
    const offset = -((this.cameraX * factor) % span) - span;
    context.save();
    context.globalAlpha = opacity;
    for (let index = 0; index < 9; index += 1) {
      const seedIndex = index + Math.floor(this.cameraX * factor / span);
      const x = offset + index * span;
      const width = 42 + seeded(seedIndex + 8) * 28;
      const height = 24 + seeded(seedIndex + 16) * 48;
      context.fillStyle = this.dawn > 0.4 ? "#23333e" : "#0b0a15";
      context.fillRect(Math.floor(x), Math.floor(baseY - height), Math.floor(width), Math.ceil(height + VIEW_HEIGHT - baseY));
      context.fillStyle = this.dawn > 0.4 ? "#342f32" : "#15101e";
      context.beginPath();
      context.moveTo(x - 5, baseY - height);
      context.lineTo(x + width / 2, baseY - height - 10 - seeded(seedIndex + 7) * 12);
      context.lineTo(x + width + 5, baseY - height);
      context.closePath();
      context.fill();
      context.fillStyle = this.dawn > 0.4 ? "#ffe0a1" : "#d98d43";
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          if (seeded(seedIndex * 19 + row * 4 + col) > 0.46) {
            context.globalAlpha = opacity * (0.35 + this.dawn * 0.55);
            context.fillRect(Math.floor(x + 7 + col * 11), Math.floor(baseY - height + 8 + row * 12), 3, 5);
          }
        }
      }
      context.globalAlpha = opacity;
    }
    context.restore();
  }

  private drawPlatforms(context: CanvasRenderingContext2D): void {
    const groundX = Math.round(-this.cameraX);
    context.fillStyle = "#17131f";
    context.fillRect(groundX, GROUND_Y, WORLD_WIDTH, GROUND_DEPTH);

    const renderPlatforms: Platform[] = this.groundSections.map((section) => ({
      ...section,
      y: GROUND_Y,
      h: GROUND_DEPTH,
      role: "ground",
    }));
    renderPlatforms.push(...this.platforms.filter((platform) => platform.role === "floating"));

    for (const platform of renderPlatforms) {
      const x = Math.round(platform.x - this.cameraX);
      if (x + platform.w < -20 || x > VIEW_WIDTH + 20) continue;
      const y = Math.round(platform.y);
      const colors = platform.material === "wood"
        ? ["#352331", "#1c1420", "#51313a"]
        : platform.material === "metal"
          ? ["#27303c", "#111722", "#6d5160"]
          : ["#332a3c", "#17131f", "#55425b"];
      context.fillStyle = colors[0];
      context.fillRect(x, y, platform.w, platform.h);
      context.fillStyle = colors[2];
      context.fillRect(x, y, platform.w, 2);
      context.fillStyle = colors[1];
      context.fillRect(x, y + 5, platform.w, platform.h - 5);

      const tile = platform.material === "wood" ? 24 : 16;
      context.strokeStyle = platform.material === "metal" ? "#403c4c" : "#2a2131";
      context.lineWidth = 1;
      for (let lineX = x - (x % tile); lineX < x + platform.w; lineX += tile) {
        context.beginPath();
        context.moveTo(Math.floor(lineX), y + 4);
        context.lineTo(Math.floor(lineX), y + Math.min(platform.h, 18));
        context.stroke();
      }
      if (platform.material === "wood") {
        context.fillStyle = "rgba(255, 189, 69, 0.1)";
        for (let lineX = x; lineX < x + platform.w; lineX += 42) context.fillRect(lineX + 8, y + 9, 18, 1);
      }

      if (imageReady(this.propsSheet)) {
        const frame = platform.material === "wood"
          ? PROP_FRAMES.roof
          : platform.material === "metal"
            ? PROP_FRAMES.brass
            : PROP_FRAMES.stone;
        const scale = platform.material === "metal" ? 0.34 : 0.32;
        const stride = platform.material === "wood" ? 100 : 94;
        context.save();
        context.beginPath();
        context.rect(x, y - 38, platform.w, Math.min(platform.h + 46, 104));
        context.clip();
        for (let tileX = x - stride * 0.5; tileX < x + platform.w + stride; tileX += stride) {
          drawAtlasFrame(context, this.propsSheet, frame, tileX, y, 1, scale, 0.92);
        }
        context.restore();
      }
    }

    context.fillStyle = "rgba(255, 205, 111, 0.34)";
    context.fillRect(groundX, GROUND_Y, WORLD_WIDTH, 1);
    for (const section of this.groundSections.slice(1)) {
      const jointX = Math.round(section.x - this.cameraX);
      if (jointX < -6 || jointX > VIEW_WIDTH + 6) continue;
      context.fillStyle = "#18131e";
      context.fillRect(jointX - 2, GROUND_Y + 2, 4, 24);
      context.fillStyle = "#6d5160";
      context.fillRect(jointX - 1, GROUND_Y + 3, 2, 20);
      context.fillStyle = "rgba(255, 205, 111, 0.48)";
      context.fillRect(jointX - 2, GROUND_Y, 4, 2);
    }
  }

  private drawWorldArchitecture(context: CanvasRenderingContext2D): void {
    if (imageReady(this.propsSheet)) {
      const bossArenaStart = 4300 - this.cameraX;
      if (bossArenaStart < VIEW_WIDTH + 120 && bossArenaStart > -1120) {
        for (let index = 0; index < 7; index += 1) {
          const x = bossArenaStart + 70 + index * 154;
          drawAtlasFrame(context, this.propsSheet, PROP_FRAMES.pillar, x, GROUND_Y, 1, 0.39, 0.72);
        }
      }

      const shrineX = 2020 - this.cameraX;
      if (shrineX > -140 && shrineX < VIEW_WIDTH + 140) {
        context.save();
        context.globalCompositeOperation = "screen";
        const glow = context.createRadialGradient(shrineX, 170, 4, shrineX, 170, 70);
        glow.addColorStop(0, `rgba(255, 211, 116, ${0.18 + Math.sin(this.elapsed * 3) * 0.04})`);
        glow.addColorStop(1, "rgba(255, 189, 69, 0)");
        context.fillStyle = glow;
        context.fillRect(shrineX - 80, 92, 160, 130);
        context.restore();
        drawAtlasFrame(context, this.propsSheet, PROP_FRAMES.shrine, shrineX, GROUND_Y, 1, 0.45, 0.98);
      }

      const gateX = 4263 - this.cameraX;
      if (gateX > -150 && gateX < VIEW_WIDTH + 150) {
        const gateFrame = this.bossDefeated ? PROP_FRAMES.brokenGate : PROP_FRAMES.gate;
        drawAtlasFrame(context, this.propsSheet, gateFrame, gateX, GROUND_Y, 1, 0.43, 0.98);
        const closed = this.bossTriggered && !this.bossDefeated;
        if (closed) {
          context.save();
          context.globalCompositeOperation = "screen";
          context.globalAlpha = 0.34 + Math.sin(this.elapsed * 8) * 0.12;
          context.strokeStyle = "#ff536a";
          context.lineWidth = 1.5;
          for (let index = -2; index < 4; index += 1) {
            context.beginPath();
            context.moveTo(gateX - 32 + index * 13, 132);
            context.lineTo(gateX - 18 + index * 13, GROUND_Y);
            context.stroke();
          }
          context.restore();
        }
      }

      if (this.bossDefeated) {
        const rubbleX = 4770 - this.cameraX;
        if (rubbleX > -150 && rubbleX < VIEW_WIDTH + 150) {
          drawAtlasFrame(context, this.propsSheet, PROP_FRAMES.goldRubble, rubbleX, GROUND_Y, 1, 0.4, 0.82);
        }
      }
      return;
    }

    const shrineX = 2020 - this.cameraX;
    if (shrineX > -120 && shrineX < VIEW_WIDTH + 120) {
      context.save();
      context.translate(Math.round(shrineX), GROUND_Y);
      context.fillStyle = "#15101c";
      context.fillRect(-45, -67, 90, 67);
      context.fillStyle = "#40233a";
      context.fillRect(-52, -69, 104, 6);
      context.fillRect(-42, -82, 84, 5);
      context.fillStyle = "#17111c";
      context.beginPath();
      context.moveTo(-58, -82);
      context.lineTo(0, -107);
      context.lineTo(58, -82);
      context.closePath();
      context.fill();
      context.strokeStyle = "#7f593e";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#ffbd45";
      context.globalAlpha = 0.34 + Math.sin(this.elapsed * 3) * 0.1;
      context.beginPath();
      context.arc(0, -47, 14, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = "#ffd887";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(0, -47, 9, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray / 8) * Math.PI * 2;
        context.moveTo(Math.cos(angle) * 11, -47 + Math.sin(angle) * 11);
        context.lineTo(Math.cos(angle) * 17, -47 + Math.sin(angle) * 17);
      }
      context.stroke();
      context.restore();
    }

    const gateX = 4230 - this.cameraX;
    if (gateX > -80 && gateX < VIEW_WIDTH + 80) {
      context.save();
      context.translate(Math.round(gateX), GROUND_Y);
      const closed = this.bossTriggered && !this.bossDefeated;
      context.fillStyle = "#100b15";
      context.fillRect(-8, -88, 9, 88);
      context.fillRect(62, -88, 9, 88);
      context.fillStyle = "#4a263a";
      context.fillRect(-17, -90, 98, 7);
      context.fillRect(-10, -107, 84, 8);
      context.fillStyle = closed ? "rgba(203, 53, 81, 0.46)" : "rgba(255, 189, 69, 0.12)";
      context.fillRect(1, -81, 61, 81);
      if (closed) {
        context.strokeStyle = "#d7475e";
        context.globalAlpha = 0.48 + Math.sin(this.elapsed * 8) * 0.18;
        for (let index = 0; index < 6; index += 1) {
          context.beginPath();
          context.moveTo(6 + index * 10, -80);
          context.lineTo(13 + index * 10, -3);
          context.stroke();
        }
      }
      context.restore();
    }

    const bossArenaStart = 4300 - this.cameraX;
    if (bossArenaStart < VIEW_WIDTH && bossArenaStart > -1100) {
      context.save();
      context.globalAlpha = 0.46;
      context.fillStyle = this.dawn > 0.4 ? "#49656a" : "#110d18";
      for (let index = 0; index < 7; index += 1) {
        const x = bossArenaStart + index * 144;
        context.fillRect(x, 111, 7, 105);
        context.beginPath();
        context.moveTo(x - 27, 115);
        context.lineTo(x + 3, 83 - (index % 2) * 12);
        context.lineTo(x + 34, 115);
        context.fill();
      }
      context.restore();
    }
  }

  private drawProps(context: CanvasRenderingContext2D): void {
    for (const prop of this.props) {
      const x = Math.round(prop.x - this.cameraX);
      if (x < -30 || x > VIEW_WIDTH + 30) continue;
      const y = Math.round(prop.y);
      if (imageReady(this.propsSheet)) {
        if (!prop.broken && prop.kind === "lantern") {
          const glow = context.createRadialGradient(x, y - 33, 2, x, y - 33, 31);
          glow.addColorStop(0, `rgba(255, 185, 77, ${0.25 + Math.sin(this.elapsed * 5 + prop.x) * 0.05})`);
          glow.addColorStop(1, "rgba(255, 123, 70, 0)");
          context.save();
          context.globalCompositeOperation = "screen";
          context.fillStyle = glow;
          context.fillRect(x - 34, y - 67, 68, 68);
          context.restore();
        }
        const frame = prop.broken
          ? PROP_FRAMES.rubble
          : prop.kind === "lantern"
            ? PROP_FRAMES.lantern
            : prop.kind === "sign"
              ? PROP_FRAMES.sign
              : PROP_FRAMES.urn;
        const scale = prop.broken ? 0.18 : prop.kind === "sign" ? 0.28 : prop.kind === "lantern" ? 0.27 : 0.26;
        const filter = prop.hitFlash > 0 ? "brightness(1.75) saturate(0.8)" : "none";
        drawAtlasFrame(context, this.propsSheet, frame, x, y, 1, scale, 1, filter);
        continue;
      }
      context.save();
      context.translate(x, y);
      if (prop.broken) {
        context.fillStyle = "#211722";
        context.fillRect(-9, -3, 6, 3);
        context.fillRect(3, -2, 8, 2);
        context.fillStyle = "rgba(255, 189, 69, 0.22)";
        context.fillRect(-1, -6, 2, 2);
        context.restore();
        continue;
      }
      if (prop.hitFlash > 0) context.globalCompositeOperation = "screen";
      if (prop.kind === "lantern") {
        context.fillStyle = "#1c111b";
        context.fillRect(-2, -36, 4, 36);
        context.fillRect(-8, -36, 16, 3);
        context.fillStyle = prop.hitFlash > 0 ? "#fff1be" : "#a83d4f";
        context.fillRect(-7, -31, 14, 16);
        context.fillStyle = "#ffbd45";
        context.globalAlpha = 0.7 + Math.sin(this.elapsed * 5 + prop.x) * 0.15;
        context.fillRect(-4, -28, 8, 10);
        context.globalAlpha = 0.18;
        context.beginPath();
        context.arc(0, -23, 18, 0, Math.PI * 2);
        context.fill();
      } else if (prop.kind === "sign") {
        context.fillStyle = prop.hitFlash > 0 ? "#e1c5a3" : "#2b1b28";
        context.fillRect(-2, -27, 4, 27);
        context.fillRect(-12, -29, 24, 14);
        context.strokeStyle = "#7c4b45";
        context.strokeRect(-10, -27, 20, 10);
      } else {
        context.fillStyle = prop.hitFlash > 0 ? "#f0d5bd" : "#3b2a40";
        context.fillRect(-7, -13, 14, 11);
        context.fillRect(-5, -17, 10, 4);
        context.fillStyle = "#6b4554";
        context.fillRect(-5, -10, 10, 2);
      }
      context.restore();
    }
  }

  private drawAfterimages(context: CanvasRenderingContext2D): void {
    for (const image of this.afterimages) {
      const alpha = (image.life / image.maxLife) * 0.42;
      if (image.pose === -1 && imageReady(this.enemySheet)) {
        drawAtlasFrame(
          context,
          this.enemySheet,
          ENEMY_FRAMES[3][1],
          image.x - this.cameraX + 12,
          image.y + 45,
          image.facing === -1 ? 1 : -1,
          0.4,
          alpha,
          "brightness(1.6) saturate(1.5)",
        );
      } else if (image.pose !== -1 && imageReady(this.heroSheet)) {
        const frameIndex = image.pose >= 1 && image.pose <= 3 ? 11 + image.pose : 10;
        drawAtlasFrame(
          context,
          this.heroSheet,
          HERO_FRAMES[frameIndex],
          image.x - this.cameraX + 9,
          image.y + 38,
          image.facing,
          0.36,
          alpha,
          "brightness(1.55) sepia(0.45) saturate(1.6)",
        );
      } else if (image.pose === -1) {
        this.drawBossModel(context, image.x - this.cameraX, image.y, image.facing, alpha, image.color, true);
      } else {
        this.drawHeroModel(context, image.x - this.cameraX, image.y, image.facing, alpha, image.color, image.pose, true);
      }
    }
  }

  private drawPlayer(context: CanvasRenderingContext2D): void {
    const player = this.player;
    if (player.invulnerable > 0 && player.hurtTimer <= 0 && Math.floor(this.elapsed * 28) % 2 === 0 && player.dashTimer <= 0) return;
    const x = player.x - this.cameraX;
    const tint = player.hurtTimer > 0 ? "#d7475e" : "#ffbd45";
    if (imageReady(this.heroSheet)) this.drawHeroSprite(context, x, player.y);
    else this.drawHeroModel(context, x, player.y, player.facing, 1, tint, player.attackStep, false);
  }

  private helperFrameIndex(): number {
    const helper = this.helper;
    if (helper.state === "cheer") return 23;
    if (helper.state === "throw") return helper.stateTimer > 0.13 ? 13 : 14;
    if (helper.state === "entrance") return 6 + (Math.floor(this.elapsed * 14) % 6);
    if (Math.abs(helper.vx) > 36) return 6 + (Math.floor(this.elapsed * 12) % 6);
    if (Math.abs(helper.vx) > 4) return 2 + (Math.floor(this.elapsed * 8) % 4);
    return Math.floor(this.elapsed * 2.2) % 2;
  }

  private drawHelper(context: CanvasRenderingContext2D): void {
    const helper = this.helper;
    if (!helper.active) return;
    const screenX = helper.x - this.cameraX;
    if (screenX < -90 || screenX > VIEW_WIDTH + 90) return;
    const baseline = helper.y + this.player.h;

    context.save();
    context.translate(Math.round(screenX), Math.round(baseline));
    context.scale(helper.facing, 1);
    if (imageReady(this.helperSheet)) {
      const frame = this.helperFrameIndex();
      const sourceX = (frame % 6) * 256;
      const sourceY = Math.floor(frame / 6) * 256;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.helperSheet, sourceX, sourceY, 256, 256, -39, -77, 78, 78);
    } else {
      context.fillStyle = "#f5c347";
      context.beginPath();
      context.arc(0, -48, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#17254e";
      context.fillRect(-9, -40, 18, 28);
      context.fillStyle = "#e8d5a4";
      context.fillRect(-7, -12, 5, 12);
      context.fillRect(2, -12, 5, 12);
    }
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.globalAlpha = 0.2 + Math.sin(this.elapsed * 7) * 0.05;
    context.strokeStyle = "#74e4df";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(Math.round(screenX), Math.round(baseline - 28), 24, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    if (helper.labelTimer > 0 && helper.gadgetLabel) {
      const alpha = clamp(helper.labelTimer * 3, 0, 1);
      context.save();
      context.globalAlpha = alpha;
      context.textAlign = "center";
      context.font = "bold 6px monospace";
      const labelWidth = Math.max(42, context.measureText(helper.gadgetLabel).width + 10);
      context.fillStyle = "rgba(4, 8, 14, 0.86)";
      context.fillRect(Math.round(screenX - labelWidth / 2), Math.round(baseline - 78), Math.round(labelWidth), 11);
      context.strokeStyle = "rgba(116, 228, 223, 0.72)";
      context.strokeRect(Math.round(screenX - labelWidth / 2) + 0.5, Math.round(baseline - 78) + 0.5, Math.round(labelWidth), 11);
      context.fillStyle = "#c9fffb";
      context.fillText(helper.gadgetLabel, Math.round(screenX), Math.round(baseline - 70));
      context.restore();
    }
  }

  private heroFrameIndex(): number {
    const player = this.player;
    if (player.ultimateTimer > 0) {
      const progress = 1 - player.ultimateTimer / ULTIMATE_DURATION;
      return progress < 0.68 ? 21 : 22;
    }
    if (player.hurtTimer > 0) return 20;
    if (this.bossDefeated && this.victoryCountdown > 0 && player.grounded) return 23;
    if (this.goldenTime > 0.16) return 19;
    if (player.dashTimer > 0) return 10;
    if (player.charmCooldown > 0.78) return 17;
    if (player.attackTimer > 0) {
      if (player.attackKind === "dive") return 16;
      if (!player.grounded) return 15;
      return 11 + clamp(player.attackStep, 1, 3);
    }
    if (player.landingTimer > 0) return 9;
    if (!player.grounded) {
      if (player.vy < -36) return 6;
      if (player.vy > 46) return 8;
      return 7;
    }
    const speed = Math.abs(player.vx);
    if (speed > 72) return 4 + (Math.floor(this.elapsed * 12) % 2);
    if (speed > 6) return 2 + (Math.floor(this.elapsed * 10) % 2);
    return Math.floor(this.elapsed * 2.4) % 2;
  }

  private drawHeroSprite(context: CanvasRenderingContext2D, x: number, y: number): void {
    const player = this.player;
    const frame = HERO_FRAMES[this.heroFrameIndex()];
    const filter = player.hurtTimer > 0
      ? "brightness(1.55) saturate(0.65) sepia(0.28)"
      : player.ultimateTimer > 0
        ? "brightness(1.12) saturate(1.18)"
        : "none";
    drawAtlasFrame(context, this.heroSheet, frame, x + player.w / 2, y + player.h, player.facing, 0.36, 1, filter);

    if (player.focus > 0) {
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.28 + Math.sin(this.elapsed * 8) * 0.08;
      context.strokeStyle = "#ffe69a";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(Math.round(x + player.w / 2), Math.round(y + 20), 10 + player.focus * 2, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  private drawHeroModel(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: 1 | -1,
    alpha: number,
    tint: string,
    pose: number,
    ghost: boolean,
  ): void {
    const player = this.player;
    const running = !ghost && player.grounded && Math.abs(player.vx) > 8;
    const attackProgress = player.attackDuration > 0 ? 1 - player.attackTimer / player.attackDuration : 0;
    const attacking = !ghost && player.attackTimer > 0;
    const dashing = !ghost && player.dashTimer > 0;
    const crouch = !ghost && player.landingTimer > 0 ? 3 : 0;
    const bob = ghost ? 0 : running ? Math.round(Math.sin(this.elapsed * 18) * 1.5) : Math.round(Math.sin(this.elapsed * 3.7) * 0.7);
    const step = running ? Math.sin(this.elapsed * 19) : 0;
    const lean = dashing ? 3 : attacking ? 1 : 0;
    context.save();
    context.globalAlpha = alpha;
    context.translate(Math.round(x + 9), Math.round(y + bob + crouch));
    context.scale(facing, 1);
    if (dashing) context.transform(1, 0, -0.16, 1, 0, 0);

    if (ghost) {
      context.fillStyle = tint;
      context.globalAlpha = alpha * 0.78;
    }

    // Tail, hair and ribbons follow the body with a delayed curve.
    context.strokeStyle = ghost ? tint : "#211521";
    context.lineWidth = 5;
    context.lineCap = "square";
    context.beginPath();
    context.moveTo(-5, 27);
    context.quadraticCurveTo(-19 - Math.sin(this.elapsed * 4) * 3, 25, -14 - Math.cos(this.elapsed * 3) * 5, 12);
    context.quadraticCurveTo(-8, 4, -16, 3);
    context.stroke();
    if (!ghost) {
      context.strokeStyle = "#6a3c3a";
      context.lineWidth = 1;
      context.stroke();
    }

    context.fillStyle = ghost ? tint : "#251722";
    context.beginPath();
    context.moveTo(-8, 8);
    context.lineTo(-12 - lean, 30);
    context.lineTo(-4, 35);
    context.lineTo(4, 28);
    context.lineTo(8, 8);
    context.closePath();
    context.fill();
    if (!ghost) {
      context.fillStyle = "#4a2a2c";
      context.fillRect(-10, 10, 3, 18);
      context.fillRect(6, 10, 2, 14);
    }

    // Legs and fitted boots.
    context.fillStyle = ghost ? tint : "#ddb095";
    context.fillRect(-5 + Math.round(step * 2), 25, 4, 6);
    context.fillRect(2 - Math.round(step * 2), 25, 4, 6);
    context.fillStyle = ghost ? tint : "#211722";
    context.fillRect(-6 + Math.round(step * 2), 30, 5, 8 - crouch);
    context.fillRect(2 - Math.round(step * 2), 30, 5, 8 - crouch);
    if (!ghost) {
      context.fillStyle = "#b77b45";
      context.fillRect(-6 + Math.round(step * 2), 31, 5, 1);
      context.fillRect(2 - Math.round(step * 2), 31, 5, 1);
    }

    // Battle robe with a split skirt.
    context.fillStyle = ghost ? tint : "#151019";
    context.beginPath();
    context.moveTo(-7, 13);
    context.lineTo(7, 13);
    context.lineTo(9, 29);
    context.lineTo(2, 26);
    context.lineTo(0, 31);
    context.lineTo(-3, 26);
    context.lineTo(-9, 30);
    context.closePath();
    context.fill();
    if (!ghost) {
      context.strokeStyle = "#d39a45";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(-6, 14);
      context.lineTo(-7, 26);
      context.lineTo(-3, 24);
      context.moveTo(6, 14);
      context.lineTo(7, 27);
      context.stroke();
      context.fillStyle = "#573044";
      context.fillRect(-4, 16, 8, 10);
    }

    // Arms: the sword arm changes pose during the three-hit chain.
    context.strokeStyle = ghost ? tint : "#dcb195";
    context.lineWidth = 4;
    context.beginPath();
    if (attacking) {
      const angle = pose === 2 ? -1.1 + attackProgress * 1.7 : pose === 3 ? 1.2 - attackProgress * 2.5 : -0.7 + attackProgress * 1.9;
      context.moveTo(5, 16);
      context.lineTo(8 + Math.cos(angle) * 9, 17 + Math.sin(angle) * 9);
    } else {
      context.moveTo(5, 16);
      context.lineTo(10, 24);
    }
    context.stroke();
    context.beginPath();
    context.moveTo(-5, 16);
    context.lineTo(-8, 23 + (running ? Math.round(step * 2) : 0));
    context.stroke();

    // Head, ears, eyes and hair.
    context.fillStyle = ghost ? tint : "#e8baa0";
    context.fillRect(-5 + lean, 4, 11, 11);
    context.fillStyle = ghost ? tint : "#2a1921";
    context.beginPath();
    context.moveTo(-6 + lean, 5);
    context.lineTo(-8 + lean, -3);
    context.lineTo(-2 + lean, 1);
    context.lineTo(3 + lean, -4);
    context.lineTo(7 + lean, 5);
    context.lineTo(6 + lean, 10);
    context.lineTo(2 + lean, 4);
    context.lineTo(-1 + lean, 3);
    context.lineTo(-5 + lean, 10);
    context.closePath();
    context.fill();
    if (!ghost) {
      context.fillStyle = "#9b5352";
      context.beginPath();
      context.moveTo(-6 + lean, 2);
      context.lineTo(-7 + lean, -1);
      context.lineTo(-3 + lean, 1);
      context.fill();
      context.beginPath();
      context.moveTo(3 + lean, 0);
      context.lineTo(6 + lean, 2);
      context.lineTo(4 + lean, 2);
      context.fill();
      context.fillStyle = "#ffd56c";
      context.fillRect(0 + lean, 8, 2, 2);
      context.fillStyle = "#3a1c21";
      context.fillRect(1 + lean, 8, 1, 1);
      context.fillStyle = "#c97974";
      context.fillRect(4 + lean, 11, 2, 1);
    }

    // Golden round talisman.
    context.fillStyle = ghost ? tint : "#ffbd45";
    context.beginPath();
    context.arc(0, 17, 2.6, 0, Math.PI * 2);
    context.fill();
    if (!ghost) {
      context.strokeStyle = "#fff0ae";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, 15);
      context.lineTo(1.5, 18.5);
      context.lineTo(-2, 16.4);
      context.lineTo(2, 16.4);
      context.lineTo(-1.5, 18.5);
      context.closePath();
      context.stroke();
    }

    // Blade and ribbon.
    context.save();
    const swordAngle = attacking
      ? pose === 2 ? -1.2 + attackProgress * 2.1 : pose === 3 ? 1.25 - attackProgress * 2.8 : -0.9 + attackProgress * 2.2
      : -0.32;
    context.translate(attacking ? 9 : 9, attacking ? 17 : 23);
    context.rotate(swordAngle);
    context.fillStyle = ghost ? tint : "#5b3b2b";
    context.fillRect(-2, -1, 6, 3);
    context.fillStyle = ghost ? tint : "#fff0c5";
    context.fillRect(3, 0, 22, 2);
    context.fillStyle = ghost ? tint : "#ffbd45";
    context.fillRect(5, 0, 18, 1);
    context.restore();

    if (!ghost && player.focus > 0) {
      context.globalAlpha = 0.36 + Math.sin(this.elapsed * 8) * 0.12;
      context.strokeStyle = tint;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(0, 17, 5 + player.focus, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  private drawEnemies(context: CanvasRenderingContext2D): void {
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.deathTimer <= 0 && enemy.state === "dead") continue;
      const x = enemy.x - this.cameraX;
      if (x < -100 || x > VIEW_WIDTH + 100) continue;
      const deathAlpha = enemy.state === "dead" ? clamp(enemy.deathTimer / 0.75, 0, 1) : 1;
      const flash = enemy.hitFlash > 0 ? "#fff0bd" : enemy.kind === "boss" ? "#d7475e" : "#ff8c64";
      if (imageReady(this.enemySheet)) this.drawEnemySprite(context, enemy, x, deathAlpha);
      else if (enemy.kind === "boss") this.drawBossModel(context, x, enemy.y, enemy.facing, deathAlpha, flash, false);
      else if (enemy.kind === "bird") this.drawBird(context, enemy, x, deathAlpha);
      else if (enemy.kind === "hound") this.drawHound(context, enemy, x, deathAlpha);
      else this.drawLanternEnemy(context, enemy, x, deathAlpha);
      this.drawEnemyTelegraph(context, enemy, x);
    }
  }

  private drawEnemySprite(context: CanvasRenderingContext2D, enemy: Enemy, x: number, alpha: number): void {
    const row = enemy.kind === "lantern" ? 0 : enemy.kind === "hound" ? 1 : enemy.kind === "bird" ? 2 : 3;
    const moving = Math.abs(enemy.vx) > 8 || enemy.state === "chase";
    const column = enemy.state === "dead" || enemy.hitFlash > 0 || enemy.state === "stagger"
      ? 4
      : enemy.state === "telegraph"
        ? 2
        : enemy.state === "attack" || enemy.state === "dash"
          ? 3
          : moving
            ? 1
            : 0;
    const scale = enemy.kind === "boss" ? 0.42 : enemy.kind === "bird" ? 0.31 : enemy.kind === "hound" ? 0.3 : 0.29;
    const filter = enemy.hitFlash > 0 ? "brightness(1.9) saturate(0.72)" : enemy.phase === 2 ? "brightness(1.08) saturate(1.3)" : "none";
    drawAtlasFrame(
      context,
      this.enemySheet,
      ENEMY_FRAMES[row][column],
      x + enemy.w / 2,
      enemy.y + enemy.h,
      enemy.facing === -1 ? 1 : -1,
      scale,
      alpha,
      filter,
    );

    if (enemy.kind === "boss" && enemy.phase === 2 && enemy.state !== "dead") {
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.18 + Math.sin(this.elapsed * 9) * 0.06;
      context.strokeStyle = "#ff536a";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(Math.round(x + enemy.w / 2), Math.round(enemy.y + 24), 31, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  private drawLanternEnemy(context: CanvasRenderingContext2D, enemy: Enemy, x: number, alpha: number): void {
    const sway = Math.round(Math.sin(this.elapsed * 4 + enemy.id) * 1.5);
    context.save();
    context.globalAlpha = alpha;
    context.translate(Math.round(x + enemy.w / 2), Math.round(enemy.y));
    context.scale(enemy.facing, 1);
    context.fillStyle = enemy.hitFlash > 0 ? "#fff2c6" : "#0d0a10";
    context.fillRect(-7, 13, 14, 21);
    context.beginPath();
    context.moveTo(-9, 32);
    context.lineTo(-2, 25);
    context.lineTo(0, 35);
    context.lineTo(4, 26);
    context.lineTo(10, 34);
    context.closePath();
    context.fill();
    context.fillStyle = enemy.hitFlash > 0 ? "#fff2c6" : "#5e2636";
    context.fillRect(-8 + sway, 3, 16, 15);
    context.fillStyle = "#ff714f";
    context.fillRect(-5 + sway, 7, 10, 7);
    context.fillStyle = "#200f1a";
    context.fillRect(-4 + sway, 9, 3, 2);
    context.fillRect(2 + sway, 9, 3, 2);
    context.strokeStyle = enemy.hitFlash > 0 ? "#fff" : "#a94c4c";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(7, 18);
    const windup = enemy.state === "telegraph" ? -9 : enemy.state === "attack" ? 14 : 6;
    context.lineTo(18, 18 + windup);
    context.stroke();
    context.fillStyle = "#d7c1ad";
    context.fillRect(17, 14 + windup, 3, 13);
    context.restore();
  }

  private drawHound(context: CanvasRenderingContext2D, enemy: Enemy, x: number, alpha: number): void {
    const stretch = enemy.state === "dash" ? 5 : 0;
    context.save();
    context.globalAlpha = alpha;
    context.translate(Math.round(x + enemy.w / 2), Math.round(enemy.y + 4));
    context.scale(enemy.facing, 1);
    context.fillStyle = enemy.hitFlash > 0 ? "#fff0c1" : "#0b0910";
    context.beginPath();
    context.moveTo(-14 - stretch, 8);
    context.lineTo(-7, 0);
    context.lineTo(4 + stretch, 2);
    context.lineTo(14 + stretch, 9);
    context.lineTo(9, 16);
    context.lineTo(-10, 16);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(6 + stretch, 3);
    context.lineTo(9 + stretch, -3);
    context.lineTo(12 + stretch, 4);
    context.fill();
    context.fillStyle = "#ff704f";
    context.fillRect(8 + stretch, 6, 3, 2);
    context.strokeStyle = "#b7554a";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(-7, 7);
    context.lineTo(0, 13);
    context.lineTo(5, 7);
    context.stroke();
    context.fillStyle = "#1f1420";
    context.fillRect(-10, 14, 5, 5);
    context.fillRect(6, 14, 5, 5);
    context.restore();
  }

  private drawBird(context: CanvasRenderingContext2D, enemy: Enemy, x: number, alpha: number): void {
    const flap = Math.sin(this.elapsed * 11 + enemy.id) > 0 ? 1 : -1;
    context.save();
    context.globalAlpha = alpha;
    context.translate(Math.round(x + enemy.w / 2), Math.round(enemy.y + enemy.h / 2));
    context.scale(enemy.facing, 1);
    context.fillStyle = enemy.hitFlash > 0 ? "#fff2c4" : "#0a0810";
    context.beginPath();
    context.moveTo(-2, 0);
    context.lineTo(-13, -5 * flap);
    context.lineTo(-8, 5);
    context.lineTo(0, 2);
    context.lineTo(11, -6 * flap);
    context.lineTo(8, 6);
    context.closePath();
    context.fill();
    context.fillStyle = "#6d2c44";
    context.fillRect(-4, -3, 8, 9);
    context.fillStyle = "#ffbd45";
    context.fillRect(1, -1, 2, 2);
    if (enemy.state === "telegraph") {
      context.strokeStyle = "#d7475e";
      context.beginPath();
      context.moveTo(4, 2);
      context.lineTo(20, 2);
      context.stroke();
    }
    context.restore();
  }

  private drawBossModel(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: 1 | -1,
    alpha: number,
    tint: string,
    ghost: boolean,
  ): void {
    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    const phase = boss?.phase ?? 1;
    const attacking = !ghost && boss && (boss.state === "attack" || boss.state === "dash");
    const windup = !ghost && boss?.state === "telegraph";
    const hairWave = Math.round(Math.sin(this.elapsed * 5) * 2);
    context.save();
    context.globalAlpha = alpha;
    context.translate(Math.round(x + 12), Math.round(y));
    context.scale(facing, 1);
    context.fillStyle = ghost ? tint : "#321225";
    context.beginPath();
    context.moveTo(-5, 7);
    context.lineTo(-12 - hairWave, 32);
    context.lineTo(-5, 42);
    context.lineTo(6, 23);
    context.lineTo(7, 5);
    context.closePath();
    context.fill();
    context.fillStyle = ghost ? tint : "#120b14";
    context.beginPath();
    context.moveTo(-7, 16);
    context.lineTo(7, 15);
    context.lineTo(12, 43);
    context.lineTo(3, 38);
    context.lineTo(0, 45);
    context.lineTo(-4, 38);
    context.lineTo(-11, 44);
    context.closePath();
    context.fill();
    if (!ghost) {
      context.strokeStyle = phase === 2 ? "#ff506c" : "#9f3451";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(-6, 17);
      context.lineTo(-8, 38);
      context.moveTo(6, 16);
      context.lineTo(9, 39);
      context.stroke();
    }
    context.fillStyle = ghost ? tint : "#d9a18e";
    context.fillRect(-5, 5, 11, 11);
    context.fillStyle = ghost ? tint : "#4b172b";
    context.beginPath();
    context.moveTo(-6, 8);
    context.lineTo(-2, -2);
    context.lineTo(7, 4);
    context.lineTo(6, 10);
    context.lineTo(2, 5);
    context.lineTo(-4, 12);
    context.closePath();
    context.fill();
    if (!ghost) {
      context.fillStyle = phase === 2 ? "#fff0d4" : "#ff6b77";
      context.fillRect(-1, 9, 2, 2);
      context.fillStyle = "#7e263e";
      context.fillRect(2, 13, 2, 1);
    }
    context.fillStyle = ghost ? tint : "#171019";
    context.fillRect(-5, 42, 5, 4);
    context.fillRect(4, 42, 5, 4);

    context.save();
    context.translate(7, 19);
    const bladeAngle = attacking ? -0.9 : windup ? 1.45 : 0.34;
    context.rotate(bladeAngle);
    context.fillStyle = ghost ? tint : "#3e1723";
    context.fillRect(-4, -2, 9, 3);
    context.fillStyle = ghost ? tint : phase === 2 ? "#fff1e2" : "#e95b6b";
    context.fillRect(4, -1, 31, 2);
    context.fillStyle = ghost ? tint : "#7b233b";
    context.fillRect(8, 1, 27, 1);
    context.restore();

    if (!ghost && phase === 2) {
      context.globalAlpha = 0.22 + Math.sin(this.elapsed * 9) * 0.08;
      context.strokeStyle = "#d7475e";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 22, 18, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  private drawEnemyTelegraph(context: CanvasRenderingContext2D, enemy: Enemy, screenX: number): void {
    if (enemy.state !== "telegraph") return;
    const pulse = 0.45 + Math.sin(this.elapsed * 23) * 0.26;
    context.save();
    context.globalAlpha = pulse;
    context.strokeStyle = enemy.kind === "boss" ? "#ff5b70" : "#ffbd45";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(Math.round(screenX + enemy.w / 2), Math.round(enemy.y - 7), 4 + (1 - enemy.stateTimer) * 3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = enemy.kind === "boss" ? "#ff5b70" : "#ffbd45";
    context.fillRect(Math.round(screenX + enemy.w / 2), Math.round(enemy.y - 9), 1, 5);
    context.restore();
  }

  private drawProjectiles(context: CanvasRenderingContext2D): void {
    for (const projectile of this.projectiles) {
      const x = projectile.x - this.cameraX;
      const y = projectile.y;
      if (x < -60 || x > VIEW_WIDTH + 60) continue;
      context.save();
      context.translate(Math.round(x), Math.round(y));
      context.rotate(projectile.angle);
      if (projectile.kind === "gadget") {
        const frame = clamp(projectile.gadgetFrame ?? 0, 0, 23);
        const group = Math.floor(frame / 6);
        const trailColor = group < 2 ? "#ffbd45" : "#74e4df";
        context.save();
        context.globalCompositeOperation = "screen";
        context.globalAlpha = 0.38;
        context.strokeStyle = trailColor;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-20, 0);
        context.lineTo(-7, 0);
        context.stroke();
        context.globalAlpha = 0.15;
        context.lineWidth = 6;
        context.stroke();
        context.restore();

        if (imageReady(this.gadgetSheet)) {
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(
            this.gadgetSheet,
            (frame % 6) * 256,
            group * 256,
            256,
            256,
            -15,
            -15,
            30,
            30,
          );
        } else if (group === 0) {
          context.fillStyle = "#14151b";
          context.fillRect(-10, -5, 20, 10);
          context.fillStyle = "#c7c9cc";
          context.fillRect(-7, -3, 11, 1);
        } else if (group === 1) {
          context.fillStyle = "#f3ead7";
          context.fillRect(-10, -6, 20, 12);
          context.fillStyle = "#a72430";
          context.fillRect(-8, -4, 5, 8);
        } else if (group === 2) {
          context.strokeStyle = "#252a30";
          context.lineWidth = 2;
          context.strokeRect(-10, -4, 8, 7);
          context.strokeRect(2, -4, 8, 7);
          context.beginPath();
          context.moveTo(-2, -1);
          context.lineTo(2, -1);
          context.stroke();
        } else {
          context.fillStyle = "#d8dadd";
          context.fillRect(-9, -9, 18, 18);
          context.fillStyle = "#888d92";
          context.fillRect(-7, 6, 14, 1);
        }
      } else if (projectile.kind === "charm") {
        context.fillStyle = "rgba(255, 189, 69, 0.2)";
        context.beginPath();
        context.arc(0, 0, 10, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#ffe69a";
        context.lineWidth = 2;
        context.beginPath();
        for (let point = 0; point < 8; point += 1) {
          const angle = point * Math.PI / 4;
          const radius = point % 2 === 0 ? 7 : 3;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (point === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.stroke();
        context.fillStyle = "#fff0ad";
        context.fillRect(-1, -1, 3, 3);
      } else if (projectile.kind === "moon") {
        context.globalAlpha = clamp(projectile.life / 0.2, 0, 1);
        context.strokeStyle = "#ffe69a";
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, 17, -1.25, 1.25);
        context.stroke();
        context.strokeStyle = "#fff";
        context.lineWidth = 1;
        context.stroke();
      } else if (projectile.kind === "bell") {
        context.fillStyle = "#fff0ad";
        context.beginPath();
        context.arc(0, 0, 3, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.32;
        context.beginPath();
        context.arc(0, 0, 8, 0, Math.PI * 2);
        context.fill();
      } else if (projectile.kind === "ember") {
        const ratio = projectile.life / projectile.maxLife;
        context.globalAlpha = ratio * 0.76;
        context.fillStyle = "#e75a3c";
        context.beginPath();
        context.moveTo(-8, 10);
        context.quadraticCurveTo(-5, -7 - Math.sin(this.elapsed * 8) * 3, 0, -13);
        context.quadraticCurveTo(8, -5, 8, 10);
        context.closePath();
        context.fill();
        context.fillStyle = "#ffbd45";
        context.fillRect(-3, 0, 6, 9);
      } else if (projectile.kind === "feather") {
        context.fillStyle = "#d7475e";
        context.beginPath();
        context.moveTo(-6, 0);
        context.lineTo(4, -3);
        context.lineTo(7, 0);
        context.lineTo(4, 3);
        context.closePath();
        context.fill();
        context.fillStyle = "#ffb0a6";
        context.fillRect(-2, 0, 7, 1);
      } else if (projectile.kind === "wave") {
        context.strokeStyle = "#d7475e";
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, 14, -1.15, 1.15);
        context.stroke();
        context.strokeStyle = "#ff9a9a";
        context.lineWidth = 1;
        context.stroke();
      } else if (projectile.kind === "seal") {
        if (projectile.vy === 0) {
          context.globalAlpha = 0.3 + Math.sin(this.elapsed * 18) * 0.12;
          context.fillStyle = "#d7475e";
          context.fillRect(-1, 0, 2, 250 - y);
          context.fillRect(-6, 248 - y, 12, 2);
        } else {
          context.fillStyle = "#e8c5b2";
          context.fillRect(-5, -12, 10, 24);
          context.fillStyle = "#a92748";
          context.fillRect(-3, -9, 6, 2);
          context.fillRect(-1, -6, 2, 11);
          context.fillRect(-3, 1, 6, 2);
          context.globalAlpha = 0.3;
          context.fillStyle = "#d7475e";
          context.fillRect(-8, -18, 16, 36);
        }
      }
      context.restore();
    }
  }

  private drawSlashes(context: CanvasRenderingContext2D): void {
    for (const slash of this.slashes) {
      const progress = 1 - slash.life / slash.maxLife;
      const alpha = Math.sin(clamp(progress, 0, 1) * Math.PI);
      const x = slash.x - this.cameraX;
      if (x < -100 || x > VIEW_WIDTH + 100) continue;
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = alpha * (slash.heavy ? 0.92 : 0.75);
      context.translate(Math.round(x), Math.round(slash.y));
      context.scale(slash.facing, 1);
      context.rotate(slash.angle);
      context.strokeStyle = slash.color;
      context.lineWidth = slash.heavy ? 4 : 2;
      context.beginPath();
      context.arc(0, 0, slash.radius * (0.72 + progress * 0.28), -1.25, 1.3);
      context.stroke();
      context.globalAlpha *= 0.35;
      context.lineWidth = slash.heavy ? 9 : 5;
      context.stroke();
      if (slash.heavy) {
        context.globalAlpha = alpha * 0.55;
        context.lineWidth = 1;
        for (let ray = 0; ray < 7; ray += 1) {
          const angle = -1 + ray * 0.34;
          context.beginPath();
          context.moveTo(Math.cos(angle) * slash.radius * 0.4, Math.sin(angle) * slash.radius * 0.4);
          context.lineTo(Math.cos(angle) * slash.radius * 1.2, Math.sin(angle) * slash.radius * 1.2);
          context.stroke();
        }
      }
      context.restore();
    }
  }

  private drawParticles(context: CanvasRenderingContext2D): void {
    context.save();
    for (const particle of this.particles) {
      const x = particle.x - this.cameraX;
      if (x < -30 || x > VIEW_WIDTH + 30) continue;
      const ratio = clamp(particle.life / particle.maxLife, 0, 1);
      context.save();
      context.translate(Math.round(x), Math.round(particle.y));
      context.rotate(particle.rotation);
      context.globalAlpha = Math.min(1, ratio * 1.6);
      context.fillStyle = particle.color;
      if (particle.kind === "spark") {
        context.globalCompositeOperation = "screen";
        context.fillRect(-particle.size * 1.7, -0.5, particle.size * 3.4, 1);
        context.fillRect(-0.5, -particle.size * 1.2, 1, particle.size * 2.4);
      } else if (particle.kind === "paper") {
        context.fillRect(-particle.size / 2, -particle.size, particle.size, particle.size * 2);
        context.fillStyle = "rgba(255, 208, 109, 0.65)";
        context.fillRect(-0.5, -particle.size, 1, particle.size * 2);
      } else if (particle.kind === "ember") {
        context.globalCompositeOperation = "screen";
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      } else if (particle.kind === "shard") {
        context.beginPath();
        context.moveTo(-particle.size, particle.size);
        context.lineTo(0, -particle.size);
        context.lineTo(particle.size * 0.7, particle.size);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, particle.size * (1.2 - ratio * 0.2), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    context.restore();
  }

  private drawDamageNumbers(context: CanvasRenderingContext2D): void {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const number of this.damageNumbers) {
      const x = number.x - this.cameraX;
      context.globalAlpha = clamp(number.life * 2.2, 0, 1);
      context.font = `${number.critical ? "bold 12px" : "bold 8px"} monospace`;
      context.fillStyle = "#160d17";
      context.fillText(String(number.value), Math.round(x + 1), Math.round(number.y + 1));
      context.fillStyle = number.critical ? "#ffe69a" : "#fff0dc";
      context.fillText(String(number.value), Math.round(x), Math.round(number.y));
    }
    context.restore();
  }

  private drawHud(context: CanvasRenderingContext2D): void {
    const player = this.player;
    context.save();
    context.imageSmoothingEnabled = false;

    // Portrait seal and health.
    context.fillStyle = "rgba(6, 4, 9, 0.78)";
    context.fillRect(8, 8, 132, 34);
    context.strokeStyle = "rgba(255, 198, 94, 0.55)";
    context.lineWidth = 1;
    context.strokeRect(8.5, 8.5, 132, 34);
    context.fillStyle = "#211621";
    context.fillRect(12, 12, 27, 27);
    context.strokeStyle = "#c78645";
    context.strokeRect(12.5, 12.5, 27, 27);
    this.drawHudPortrait(context, 25, 14);

    context.fillStyle = "#f1dfc8";
    context.font = "8px serif";
    context.fillText("某美少女N", 45, 17);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(45, 22, 85, 6);
    const hpRatio = player.hp / player.maxHp;
    const hpGradient = context.createLinearGradient(45, 0, 130, 0);
    hpGradient.addColorStop(0, "#7e233f");
    hpGradient.addColorStop(1, "#ed5962");
    context.fillStyle = hpGradient;
    context.fillRect(45, 22, Math.floor(85 * hpRatio), 6);
    context.fillStyle = "rgba(255,255,255,0.42)";
    context.fillRect(45, 22, Math.floor(85 * hpRatio), 1);
    context.font = "6px monospace";
    context.fillStyle = "#c8b7a1";
    context.fillText(`HP ${player.hp}/${player.maxHp}`, 46, 35);
    context.fillText(`九命 ${player.lives}`, 104, 35);

    // GMK charge: one segment per confirmed player hit.
    const gmkReady = player.focus >= ULTIMATE_HITS_REQUIRED;
    const gmkPulse = gmkReady ? 0.62 + Math.sin(this.elapsed * 10) * 0.26 : 0;
    context.fillStyle = "rgba(6, 4, 9, 0.78)";
    context.fillRect(9, 46, 131, 19);
    context.strokeStyle = gmkReady ? `rgba(255, 230, 154, ${gmkPulse})` : "rgba(255, 198, 94, 0.26)";
    context.strokeRect(9.5, 46.5, 131, 19);
    context.font = "bold 7px monospace";
    context.fillStyle = gmkReady ? "#ffe69a" : "#d5c2aa";
    context.fillText(gmkReady ? "GMK READY" : `GMK ${player.focus}/${ULTIMATE_HITS_REQUIRED}`, 14, 58);
    for (let index = 0; index < ULTIMATE_HITS_REQUIRED; index += 1) {
      const lit = index < player.focus;
      const segmentX = 69 + index * 13;
      context.fillStyle = lit ? (gmkReady ? "#ffe69a" : "#ffbd45") : "rgba(255,255,255,0.07)";
      context.fillRect(segmentX, 51, 10, 7);
      context.strokeStyle = lit ? "rgba(255, 240, 180, 0.9)" : "#554651";
      context.strokeRect(segmentX + 0.5, 51.5, 10, 7);
      if (lit) {
        context.fillStyle = "rgba(255,255,255,0.46)";
        context.fillRect(segmentX + 1, 52, 8, 1);
      }
    }

    if (this.helper.active) {
      context.fillStyle = "rgba(4, 9, 15, 0.74)";
      context.fillRect(9, 68, 158, 14);
      context.strokeStyle = "rgba(116, 228, 223, 0.45)";
      context.strokeRect(9.5, 68.5, 158, 14);
      context.fillStyle = "#74e4df";
      context.fillRect(14, 73, 4, 4);
      context.font = "6px monospace";
      context.fillText("SUPPORT / 某ガジェオタG　GADGET RAIN", 22, 78);
    }

    // Objective and current blessing.
    context.textAlign = "right";
    context.fillStyle = "rgba(6, 4, 9, 0.66)";
    context.fillRect(337, 9, 135, 27);
    context.fillStyle = "#d7475e";
    context.font = "6px monospace";
    context.fillText(this.bossTriggered && !this.bossDefeated ? "OBJECTIVE / BREAK THE VOW" : "OBJECTIVE / FIND THE SUN SIGIL", 467, 19);
    context.fillStyle = "#eadac5";
    context.font = "8px serif";
    context.fillText(this.bossTriggered && !this.bossDefeated ? "鈴霞の緋月契を断て" : "玻璃坂を越え、日輪符を追え", 467, 31);
    if (this.upgrade) {
      const blessingNames: Record<Exclude<Upgrade, null>, string> = { fire: "猫又火", bell: "金鈴返し", moon: "残月爪" };
      context.fillStyle = "rgba(6, 4, 9, 0.6)";
      context.fillRect(393, 40, 79, 13);
      context.fillStyle = "#ffbd45";
      context.font = "7px serif";
      context.fillText(`加護　${blessingNames[this.upgrade]}`, 467, 49);
    }

    // Combo rank.
    if (this.combo > 0) {
      const ranks = ["爪", "牙", "月", "星", "天"];
      const rankIndex = clamp(Math.floor((this.combo - 1) / 5), 0, ranks.length - 1);
      const pulse = 1 + Math.sin(this.elapsed * 14) * 0.06;
      context.save();
      context.translate(444, 82);
      context.scale(pulse, pulse);
      context.textAlign = "center";
      context.fillStyle = "rgba(6, 4, 9, 0.64)";
      context.fillRect(-30, -16, 60, 34);
      context.font = "bold 21px serif";
      context.fillStyle = rankIndex >= 3 ? "#ffe69a" : "#d7475e";
      context.fillText(ranks[rankIndex], 0, 3);
      context.font = "bold 8px monospace";
      context.fillStyle = "#fff0de";
      context.fillText(`${this.combo} HITS`, 0, 14);
      context.restore();
    }

    const boss = this.enemies.find((enemy) => enemy.kind === "boss" && enemy.active && enemy.state !== "dead");
    if (boss && this.bossTriggered) {
      const ratio = boss.hp / boss.maxHp;
      context.textAlign = "center";
      context.font = "7px serif";
      context.fillStyle = "#f3dfce";
      context.fillText(`緋月の剣巫　鈴霞　　${boss.phase === 2 ? "第二相" : "第一相"}`, VIEW_WIDTH / 2, 239);
      context.fillStyle = "rgba(4,3,7,0.8)";
      context.fillRect(79, 245, 322, 9);
      context.strokeStyle = "rgba(255, 198, 94, 0.48)";
      context.strokeRect(79.5, 245.5, 322, 9);
      const bossGradient = context.createLinearGradient(82, 0, 398, 0);
      bossGradient.addColorStop(0, "#6a1837");
      bossGradient.addColorStop(0.65, "#ce3555");
      bossGradient.addColorStop(1, "#ff7377");
      context.fillStyle = bossGradient;
      context.fillRect(82, 248, Math.floor(316 * ratio), 3);
      if (boss.poise > 0) {
        context.fillStyle = "#ffbd45";
        context.fillRect(82, 253, Math.floor(316 * (boss.poise / boss.maxPoise)), 1);
      }
    }
    context.restore();
  }

  private drawHudPortrait(context: CanvasRenderingContext2D, centerX: number, topY: number): void {
    if (imageReady(this.gmkCutin)) {
      context.save();
      context.beginPath();
      context.rect(centerX - 11, topY, 22, 24);
      context.clip();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.gmkCutin, 44, 146, 430, 470, centerX - 12, topY - 1, 25, 27);
      const shade = context.createLinearGradient(centerX - 11, 0, centerX + 11, 0);
      shade.addColorStop(0, "rgba(9, 4, 11, 0.32)");
      shade.addColorStop(0.72, "rgba(9, 4, 11, 0)");
      shade.addColorStop(1, "rgba(255, 196, 86, 0.18)");
      context.fillStyle = shade;
      context.fillRect(centerX - 11, topY, 22, 24);
      context.restore();
      return;
    }
    context.save();
    context.translate(centerX, topY);
    context.fillStyle = "#2b1821";
    context.beginPath();
    context.moveTo(-10, 9);
    context.lineTo(-8, -1);
    context.lineTo(-3, 3);
    context.lineTo(4, -2);
    context.lineTo(10, 9);
    context.lineTo(9, 23);
    context.lineTo(-9, 23);
    context.closePath();
    context.fill();
    context.fillStyle = "#dcaa91";
    context.fillRect(-6, 8, 13, 11);
    context.fillStyle = "#2b1821";
    context.fillRect(-7, 6, 15, 4);
    context.fillRect(-7, 7, 4, 14);
    context.fillRect(6, 7, 3, 14);
    context.fillStyle = "#ffcf62";
    context.fillRect(-3, 12, 2, 2);
    context.fillRect(3, 12, 2, 2);
    context.fillStyle = "#b76565";
    context.fillRect(1, 17, 3, 1);
    context.restore();
  }

  private drawTechniqueBanner(context: CanvasRenderingContext2D): void {
    if (this.skillNameTimer <= 0 || !this.skillName) return;
    const fade = clamp(this.skillNameTimer * 4, 0, 1);
    const width = 188;
    const x = VIEW_WIDTH / 2 - width / 2;
    const y = this.bossTriggered ? 55 : 67;
    context.save();
    context.globalAlpha = fade;
    context.fillStyle = "rgba(5, 4, 9, 0.76)";
    context.fillRect(x, y, width, 18);
    const gradient = context.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, "rgba(255, 189, 69, 0)");
    gradient.addColorStop(0.5, "rgba(255, 189, 69, 0.85)");
    gradient.addColorStop(1, "rgba(255, 189, 69, 0)");
    context.fillStyle = gradient;
    context.fillRect(x, y, width, 1);
    context.fillRect(x, y + 17, width, 1);
    context.textAlign = "center";
    context.font = "10px serif";
    context.fillStyle = "#fff0d2";
    context.fillText(this.skillName, VIEW_WIDTH / 2, y + 12);
    context.restore();
  }

  private drawTutorialPrompts(context: CanvasRenderingContext2D): void {
    if (this.state !== "playing" || this.bossTriggered) return;
    const prompts: Array<{ x: number; label: string; keys: string }> = [
      { x: 220, label: "影の街を進む", keys: "A  D" },
      { x: 510, label: "二段跳び", keys: "SPACE ×2" },
      { x: 710, label: "三段斬り", keys: "J  J  J" },
      { x: 980, label: "攻撃直前に影走り", keys: "L" },
      { x: 1260, label: "護符は敵を引き寄せる", keys: "K" },
    ];
    context.save();
    context.textAlign = "center";
    for (const prompt of prompts) {
      const x = prompt.x - this.cameraX;
      if (x < -80 || x > VIEW_WIDTH + 80 || Math.abs(this.player.x - prompt.x) > 230) continue;
      const y = 128 + Math.sin(this.elapsed * 3 + prompt.x) * 2;
      context.globalAlpha = clamp(1 - Math.abs(this.player.x - prompt.x) / 230, 0.18, 0.72);
      context.fillStyle = "rgba(5,4,9,0.72)";
      context.fillRect(Math.round(x - 51), Math.round(y - 13), 102, 24);
      context.strokeStyle = "rgba(255,189,69,0.38)";
      context.strokeRect(Math.round(x - 51) + 0.5, Math.round(y - 13) + 0.5, 102, 24);
      context.font = "6px serif";
      context.fillStyle = "#cdbda7";
      context.fillText(prompt.label, x, y - 3);
      context.font = "bold 8px monospace";
      context.fillStyle = "#ffe69a";
      context.fillText(prompt.keys, x, y + 7);
    }
    context.restore();
  }

  private drawUltimateOverlay(context: CanvasRenderingContext2D): void {
    const timer = this.player.ultimateTimer;
    if (timer <= 0) return;
    const progress = clamp(1 - timer / ULTIMATE_DURATION, 0, 1);
    const flashScale = this.flashes ? 1 : 0.34;
    const drawCutinPlate = (alpha: number, offsetX = 0, zoom = 1): void => {
      if (!imageReady(this.gmkCutin)) return;
      const sourceY = 132;
      const sourceHeight = 760;
      const width = 500 * zoom;
      const height = 230 * zoom;
      context.save();
      context.globalAlpha = alpha;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        this.gmkCutin,
        0,
        sourceY,
        this.gmkCutin.naturalWidth,
        sourceHeight,
        -10 + offsetX - (width - 500) * 0.5,
        20 - (height - 230) * 0.5,
        width,
        height,
      );
      context.restore();
    };

    context.save();
    context.fillStyle = `rgba(3, 2, 6, ${0.24 + Math.sin(progress * Math.PI) * 0.28})`;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 0–170ms: an inward pull and freeze before the expensive card appears.
    if (progress < 0.08) {
      const open = progress / 0.08;
      context.fillStyle = `rgba(2, 1, 4, ${0.5 + open * 0.38})`;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      context.globalCompositeOperation = "screen";
      context.strokeStyle = `rgba(255, 218, 132, ${open * 0.72})`;
      context.lineWidth = 1;
      for (let index = 0; index < 12; index += 1) {
        const y = 28 + index * 18;
        context.beginPath();
        context.moveTo(240 - open * 250, y);
        context.lineTo(240 + open * 250, y + (index - 6) * 1.5);
        context.stroke();
      }
      context.restore();
      return;
    }

    // 170–900ms: hero portrait card. A faint HUD remains beneath it for continuity.
    if (progress < 0.42) {
      const phase = (progress - 0.08) / 0.34;
      const reveal = clamp(phase * 7, 0, 1);
      const exit = clamp((phase - 0.84) * 6.25, 0, 1);
      context.save();
      context.beginPath();
      context.moveTo(-24 + exit * 48, 24);
      context.lineTo(496, 13);
      context.lineTo(480 - exit * 54, 247);
      context.lineTo(-18, 257);
      context.closePath();
      context.clip();
      context.fillStyle = "#07050a";
      context.fillRect(0, 16, VIEW_WIDTH, 240);
      drawCutinPlate(0.96 * reveal, -6 + phase * 4, 1 + phase * 0.018);

      const ink = context.createLinearGradient(0, 0, 310, 0);
      ink.addColorStop(0, "rgba(4, 4, 9, 0.96)");
      ink.addColorStop(0.42, "rgba(5, 4, 9, 0.55)");
      ink.addColorStop(1, "rgba(5, 4, 9, 0)");
      context.fillStyle = ink;
      context.fillRect(0, 20, 340, 230);

      context.globalAlpha = reveal;
      context.strokeStyle = "#ffcf67";
      context.lineWidth = 1.25;
      context.beginPath();
      context.moveTo(0, 29);
      context.lineTo(344, 18);
      context.moveTo(76, 251);
      context.lineTo(480, 237);
      context.stroke();
      context.strokeStyle = "rgba(103, 226, 218, 0.74)";
      context.beginPath();
      context.moveTo(0, 35);
      context.lineTo(286, 26);
      context.stroke();

      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.font = "italic 700 57px Georgia, serif";
      context.lineWidth = 5;
      context.strokeStyle = "rgba(4, 2, 7, 0.92)";
      context.strokeText("GMK", 24, 183);
      context.fillStyle = "#fff0c8";
      context.fillText("GMK", 24, 183);
      context.font = "700 8px serif";
      context.fillStyle = "#ffca61";
      context.fillText("護符臨界・九命断", 29, 199);
      context.font = "6px monospace";
      context.fillStyle = "#75ddd4";
      context.fillText("GOLDEN MANIFEST / KARMIC BREAK", 29, 211);
      context.fillStyle = "rgba(255, 240, 207, 0.78)";
      context.fillText("某美少女N　— NINTH LIFE EXECUTION", 29, 228);
      context.restore();
    } else if (progress < 0.56) {
      // Portrait stays on one side while the live battlefield is revealed.
      const split = (progress - 0.42) / 0.14;
      const edge = lerp(480, 142, split);
      context.save();
      context.beginPath();
      context.moveTo(0, 20);
      context.lineTo(edge + 34, 20);
      context.lineTo(edge - 28, 250);
      context.lineTo(0, 250);
      context.closePath();
      context.clip();
      context.fillStyle = "#060409";
      context.fillRect(0, 20, VIEW_WIDTH, 230);
      drawCutinPlate(0.94, -10 - split * 18, 1.04);
      context.restore();
      context.strokeStyle = "#ffd36d";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(edge + 34, 18);
      context.lineTo(edge - 28, 252);
      context.stroke();
      context.fillStyle = "#fff1cf";
      context.font = "italic 700 24px Georgia, serif";
      context.fillText("GMK", 18, 228);
    } else if (progress < 0.7) {
      // Live-action clash: sigils, beams and vignette carry the force without changing camera.
      const clash = (progress - 0.56) / 0.14;
      const centerX = clamp(this.player.x - this.cameraX + this.player.w / 2 + 116, 170, 330);
      const centerY = 139;
      context.save();
      context.globalCompositeOperation = "screen";
      const beam = context.createLinearGradient(0, 0, centerX + 90, 0);
      beam.addColorStop(0, "rgba(255, 190, 69, 0)");
      beam.addColorStop(0.45, `rgba(255, 207, 102, ${0.34 + clash * 0.3})`);
      beam.addColorStop(0.77, `rgba(255, 249, 218, ${0.7 * flashScale})`);
      beam.addColorStop(1, "rgba(105, 226, 217, 0)");
      context.fillStyle = beam;
      context.beginPath();
      context.moveTo(0, centerY - 5 - clash * 7);
      context.lineTo(centerX + 16, centerY - 2);
      context.lineTo(centerX + 16, centerY + 2);
      context.lineTo(0, centerY + 5 + clash * 7);
      context.closePath();
      context.fill();
      context.strokeStyle = `rgba(255, 231, 159, ${0.72 * flashScale})`;
      context.lineWidth = 1;
      for (let ring = 0; ring < 7; ring += 1) {
        const radius = 15 + ring * 12 + clash * 8;
        context.beginPath();
        context.arc(centerX, centerY, radius, -1.15 + ring * 0.09, 1.8 + ring * 0.12);
        context.stroke();
      }
      for (let ray = 0; ray < 18; ray += 1) {
        const angle = (ray / 18) * Math.PI * 2 + clash;
        const inner = 20 + clash * 10;
        const outer = 64 + seeded(ray + 222) * 48;
        context.beginPath();
        context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        context.stroke();
      }
      context.restore();
    } else if (progress < 0.79) {
      // A short final card repeats the heroine at a tighter crop before the hit.
      const finalCard = (progress - 0.7) / 0.09;
      context.save();
      context.beginPath();
      context.moveTo(128 - finalCard * 30, 18);
      context.lineTo(VIEW_WIDTH, 18);
      context.lineTo(VIEW_WIDTH, 252);
      context.lineTo(76 - finalCard * 24, 252);
      context.closePath();
      context.clip();
      context.fillStyle = "#060308";
      context.fillRect(0, 18, VIEW_WIDTH, 234);
      drawCutinPlate(0.98, -18, 1.09 + finalCard * 0.025);
      context.restore();
      context.fillStyle = "rgba(5, 2, 8, 0.86)";
      context.beginPath();
      context.moveTo(0, 18);
      context.lineTo(208, 18);
      context.lineTo(164, 252);
      context.lineTo(0, 252);
      context.closePath();
      context.fill();
      context.font = "italic 700 50px Georgia, serif";
      context.fillStyle = "#fff1cf";
      context.fillText("GMK", 23, 151);
      context.font = "7px monospace";
      context.fillStyle = "#ffcc64";
      context.fillText("FINAL SIGIL / BREAK", 27, 166);
    } else {
      // Impact and recovery. The real game remains visible under the slash lattice.
      const impact = (progress - 0.79) / 0.21;
      const fade = 1 - clamp((impact - 0.42) / 0.58, 0, 1);
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = fade * flashScale;
      context.strokeStyle = "#fff0b0";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-18, 218);
      context.lineTo(498, 48);
      context.stroke();
      context.lineWidth = 1;
      for (let index = 0; index < 13; index += 1) {
        const offset = (index - 6) * 13;
        context.beginPath();
        context.moveTo(-20, 218 + offset);
        context.lineTo(500, 48 + offset * 0.42);
        context.stroke();
      }
      const core = context.createRadialGradient(284, 136, 0, 284, 136, 146);
      core.addColorStop(0, `rgba(255, 255, 237, ${0.8 * fade})`);
      core.addColorStop(0.16, `rgba(255, 207, 92, ${0.48 * fade})`);
      core.addColorStop(1, "rgba(111, 227, 217, 0)");
      context.fillStyle = core;
      context.fillRect(118, 0, 332, 270);
      context.restore();
    }

    context.save();
    context.globalAlpha = 0.08;
    context.fillStyle = "#fff4d7";
    const noiseTick = Math.floor(this.elapsed * 30);
    for (let index = 0; index < 38; index += 1) {
      const x = Math.floor(seeded(index + noiseTick * 3) * VIEW_WIDTH);
      const y = Math.floor(seeded(index + noiseTick * 5 + 91) * VIEW_HEIGHT);
      context.fillRect(x, y, 1, 1);
    }
    context.restore();
    context.restore();
  }

  private drawScreenEffects(context: CanvasRenderingContext2D): void {
    if (this.goldenTime > 0) {
      const alpha = clamp(this.goldenTime * 1.4, 0, 0.5);
      const vignette = context.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 74, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 260);
      vignette.addColorStop(0, "rgba(255, 217, 131, 0)");
      vignette.addColorStop(1, `rgba(255, 189, 69, ${alpha})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      context.strokeStyle = `rgba(255, 230, 154, ${alpha * 1.4})`;
      context.strokeRect(3.5, 3.5, VIEW_WIDTH - 7, VIEW_HEIGHT - 7);
    }

    if (this.redFlash > 0) {
      const vignette = context.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 45, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 260);
      vignette.addColorStop(0, "rgba(156, 27, 52, 0)");
      vignette.addColorStop(1, `rgba(163, 30, 56, ${this.redFlash})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    if (this.whiteFlash > 0) {
      context.fillStyle = `rgba(255, 245, 219, ${Math.min(0.8, this.whiteFlash)})`;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      if (this.whiteFlash > 0.22) {
        context.globalCompositeOperation = "screen";
        context.fillStyle = `rgba(255, 66, 94, ${this.whiteFlash * 0.11})`;
        context.fillRect(3, 0, 2, VIEW_HEIGHT);
        context.fillRect(VIEW_WIDTH - 7, 0, 3, VIEW_HEIGHT);
        context.fillStyle = `rgba(76, 226, 218, ${this.whiteFlash * 0.09})`;
        context.fillRect(0, 0, 2, VIEW_HEIGHT);
        context.fillRect(VIEW_WIDTH - 3, 0, 2, VIEW_HEIGHT);
      }
      context.globalCompositeOperation = "source-over";
    }

    if (this.state === "dead") {
      const alpha = clamp(1 - this.deathTimer / 1.65, 0, 0.74);
      context.fillStyle = `rgba(5, 3, 8, ${alpha})`;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
  }
}
