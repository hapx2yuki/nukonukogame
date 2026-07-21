export type SoundName =
  | "attack"
  | "heavy"
  | "hit"
  | "kill"
  | "dash"
  | "dodge"
  | "charm"
  | "jump"
  | "land"
  | "hurt"
  | "enemyCue"
  | "break"
  | "boss"
  | "ultimate"
  | "victory"
  | "select"
  | "dialogue"
  | "cutin"
  | "cutinGmk"
  | "ultimateImpact"
  | "bossPhase";

export type MusicMode = "explore" | "combat" | "boss" | "victory";

interface GeneratedSoundConfig {
  path: string;
  gain: number;
  playbackRate?: number;
}

interface MusicTrackConfig {
  path: string;
  gain: number;
}

const GENERATED_SOUNDS: Record<SoundName, GeneratedSoundConfig> = {
  attack: { path: "/assets/audio/sfx/slash.mp3", gain: 0.78 },
  heavy: { path: "/assets/audio/sfx/heavy-slash.mp3", gain: 0.82 },
  hit: { path: "/assets/audio/sfx/impact-hit.mp3", gain: 0.72 },
  kill: { path: "/assets/audio/sfx/enemy-defeat.mp3", gain: 0.76 },
  dash: { path: "/assets/audio/sfx/dash.mp3", gain: 0.72 },
  dodge: { path: "/assets/audio/sfx/parry.mp3", gain: 0.88 },
  charm: { path: "/assets/audio/sfx/gadget-magic.mp3", gain: 0.72 },
  jump: { path: "/assets/audio/sfx/jump.mp3", gain: 0.72 },
  land: { path: "/assets/audio/sfx/land.mp3", gain: 0.66 },
  hurt: { path: "/assets/audio/sfx/hurt.mp3", gain: 0.7 },
  enemyCue: { path: "/assets/audio/sfx/enemy-cue.mp3", gain: 0.74 },
  break: { path: "/assets/audio/sfx/guard-break.mp3", gain: 0.76 },
  boss: { path: "/assets/audio/sfx/boss-intro.mp3", gain: 0.8 },
  ultimate: { path: "/assets/audio/sfx/ultimate.mp3", gain: 0.72 },
  victory: { path: "/assets/audio/sfx/victory-stinger.mp3", gain: 0.76 },
  select: { path: "/assets/audio/sfx/ui-select.mp3", gain: 0.68 },
  dialogue: { path: "/assets/audio/sfx/dialogue-tick.mp3", gain: 0.28 },
  cutin: { path: "/assets/audio/sfx/cutin-kin.mp3", gain: 0.84 },
  cutinGmk: { path: "/assets/audio/sfx/cutin-gmk.mp3", gain: 0.94 },
  ultimateImpact: { path: "/assets/audio/sfx/ultimate-impact.mp3", gain: 0.96 },
  bossPhase: { path: "/assets/audio/sfx/boss-phase-shift.mp3", gain: 0.92 },
};

const FOOTSTEP_SOUNDS: Record<"wood" | "stone" | "metal", GeneratedSoundConfig> = {
  wood: { path: "/assets/audio/sfx/footstep-wood.mp3", gain: 0.34 },
  stone: { path: "/assets/audio/sfx/footstep-stone.mp3", gain: 0.32 },
  metal: { path: "/assets/audio/sfx/footstep-metal.mp3", gain: 0.3 },
};

const MUSIC_TRACKS: Record<MusicMode, MusicTrackConfig> = {
  explore: { path: "/assets/audio/music/explore.mp3", gain: 0.82 },
  combat: { path: "/assets/audio/music/combat.mp3", gain: 0.66 },
  boss: { path: "/assets/audio/music/boss.mp3", gain: 0.74 },
  victory: { path: "/assets/audio/music/victory.mp3", gain: 0.84 },
};

const RAIN_AMBIENCE_PATH = "/assets/audio/sfx/rain-loop.mp3";

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private generatedBuffers = new Map<string, AudioBuffer>();
  private generatedSoundPromise: Promise<void> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicSourceGain: GainNode | null = null;
  private activeMusicMode: MusicMode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private mode: MusicMode = "explore";
  private muted = false;
  private pageHidden = document.hidden;
  private started = false;

  get isMuted(): boolean {
    return this.muted;
  }

  async start(): Promise<void> {
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();

      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 7;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.18;

      this.master = this.context.createGain();
      this.master.gain.value = this.muted || this.pageHidden ? 0 : 0.72;
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.targetMusicGain();
      this.sfxBus = this.context.createGain();
      this.sfxBus.gain.value = 0.75;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }

    if (this.context.state === "suspended") await this.context.resume();
    await this.loadGeneratedSounds();
    if (!this.started) {
      this.started = true;
      this.startAmbience();
      if (!this.startGeneratedMusic(this.mode)) this.startMusicLoop();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  setPageHidden(hidden: boolean): void {
    this.pageHidden = hidden;
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted || this.pageHidden ? 0 : 0.72, now, 0.035);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMode(mode: MusicMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.musicStep = 0;
    if (this.context && this.musicBus) {
      const now = this.context.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setTargetAtTime(this.targetMusicGain(), now, 0.25);
    }
    if (this.started && !this.startGeneratedMusic(mode)) this.startMusicLoop();
  }

  footstep(material: "wood" | "stone" | "metal" = "wood"): void {
    if (!this.ready()) return;
    const generated = FOOTSTEP_SOUNDS[material];
    if (this.generatedBuffers.has(generated.path)) {
      this.playGeneratedBuffer(
        generated.path,
        generated.gain,
        0.94 + Math.random() * 0.12,
      );
      return;
    }
    if (material === "wood") {
      this.noise(0.035, 0.035, 880);
      this.tone(96, 0.045, "triangle", 0.025, 72);
    } else if (material === "stone") {
      this.noise(0.025, 0.045, 1800);
      this.tone(185, 0.026, "square", 0.018, 130);
    } else {
      this.tone(470, 0.07, "sine", 0.026, 290);
      this.noise(0.018, 0.028, 3200);
    }
  }

  sfx(name: SoundName): void {
    if (!this.ready()) return;
    if (name === "cutinGmk") this.duckMusic(1.02, 0.25);
    else if (name === "ultimateImpact") this.duckMusic(1.18, 0.24);
    else if (name === "bossPhase") this.duckMusic(1.32, 0.2);
    if (this.playGeneratedSound(name)) return;
    switch (name) {
      case "attack":
        this.sweep(520, 1120, 0.085, 0.09, "sawtooth");
        this.noise(0.055, 0.07, 4200);
        break;
      case "heavy":
        this.sweep(310, 1280, 0.14, 0.13, "sawtooth");
        this.noise(0.09, 0.12, 2600);
        this.tone(74, 0.11, "triangle", 0.1, 48);
        break;
      case "hit":
        this.noise(0.045, 0.13, 5200);
        this.tone(128, 0.065, "square", 0.09, 72);
        this.tone(940 + Math.random() * 80, 0.05, "sine", 0.045, 610);
        break;
      case "kill":
        this.noise(0.16, 0.15, 1900);
        this.sweep(180, 55, 0.2, 0.14, "sawtooth");
        this.chime([659, 988, 1318], 0.22, 0.05);
        break;
      case "dash":
        this.noise(0.12, 0.105, 1700);
        this.sweep(820, 150, 0.12, 0.09, "triangle");
        break;
      case "dodge":
        this.chime([880, 1320, 1760], 0.32, 0.085);
        this.sweep(120, 950, 0.16, 0.055, "sine");
        break;
      case "charm":
        this.chime([523, 784, 1046], 0.24, 0.05);
        this.sweep(420, 920, 0.18, 0.045, "sine");
        break;
      case "jump":
        this.sweep(190, 420, 0.08, 0.045, "square");
        break;
      case "land":
        this.noise(0.07, 0.08, 610);
        this.tone(58, 0.08, "triangle", 0.065, 42);
        break;
      case "hurt":
        this.noise(0.1, 0.13, 520);
        this.sweep(180, 72, 0.15, 0.11, "square");
        break;
      case "enemyCue":
        this.tone(210, 0.25, "sawtooth", 0.075, 120);
        this.tone(318, 0.18, "square", 0.04, 190, 0.04);
        break;
      case "break":
        this.noise(0.22, 0.13, 1400);
        this.tone(72, 0.14, "triangle", 0.08, 45);
        break;
      case "boss":
        this.tone(49, 0.75, "sawtooth", 0.16, 38);
        this.tone(74, 0.62, "square", 0.06, 55, 0.08);
        this.noise(0.32, 0.09, 650);
        break;
      case "ultimate":
        this.sweep(86, 1420, 0.55, 0.16, "sawtooth");
        this.chime([440, 660, 880, 1320], 0.72, 0.085, 0.12);
        this.noise(0.5, 0.18, 3600, 0.14);
        break;
      case "cutinGmk":
        this.sweep(220, 2320, 0.38, 0.18, "sawtooth");
        this.chime([880, 1320, 1760, 2640], 0.7, 0.13);
        this.tone(52, 0.54, "triangle", 0.17, 34, 0.08);
        break;
      case "ultimateImpact":
        this.noise(0.9, 0.24, 980);
        this.tone(46, 0.86, "triangle", 0.24, 24);
        this.sweep(1600, 90, 0.64, 0.17, "sawtooth");
        break;
      case "bossPhase":
        this.tone(42, 1.08, "sawtooth", 0.2, 29);
        this.sweep(120, 1640, 0.82, 0.17, "square");
        this.noise(0.72, 0.18, 720, 0.14);
        break;
      case "victory":
        this.chime([392, 523, 659, 784, 1046], 1.2, 0.075);
        break;
      case "select":
        this.chime([660, 990], 0.16, 0.04);
        break;
      case "dialogue":
        this.tone(720 + Math.random() * 110, 0.04, "square", 0.025, 540);
        break;
    }
  }

  private async loadGeneratedSounds(): Promise<void> {
    if (!this.context) return;
    if (!this.generatedSoundPromise) {
      const context = this.context;
      const paths = [...new Set([
        ...Object.values(GENERATED_SOUNDS).map((config) => config.path),
        ...Object.values(FOOTSTEP_SOUNDS).map((config) => config.path),
        ...Object.values(MUSIC_TRACKS).map((config) => config.path),
        RAIN_AMBIENCE_PATH,
      ])];
      this.generatedSoundPromise = Promise.all(paths.map(async (path) => {
        try {
          const response = await fetch(path);
          if (!response.ok) return;
          const encodedAudio = await response.arrayBuffer();
          const decodedAudio = await context.decodeAudioData(encodedAudio);
          this.generatedBuffers.set(path, decodedAudio);
        } catch {
          // The procedural fallback in sfx() remains available if a sample cannot load.
        }
      })).then(() => undefined);
    }
    await this.generatedSoundPromise;
  }

  private playGeneratedSound(name: SoundName): boolean {
    const config = GENERATED_SOUNDS[name];
    if (!this.generatedBuffers.has(config.path)) return false;

    if (name === "ultimate") {
      this.playGeneratedBuffer(config.path, config.gain, 1, 0);
      const parryPath = GENERATED_SOUNDS.dodge.path;
      if (this.generatedBuffers.has(parryPath)) {
        this.playGeneratedBuffer(parryPath, 0.74, 1.12, 0.015);
        this.playGeneratedBuffer(parryPath, 0.66, 0.94, 0.185);
      }
      return true;
    }

    const variation = name === "attack" || name === "heavy"
      ? 0.96 + Math.random() * 0.08
      : name === "dialogue"
        ? 0.94 + Math.random() * 0.13
        : 1;
    this.playGeneratedBuffer(
      config.path,
      config.gain,
      (config.playbackRate ?? 1) * variation,
    );
    return true;
  }

  private playGeneratedBuffer(
    path: string,
    volume: number,
    playbackRate: number,
    delay = 0,
    pan = 0,
  ): void {
    if (!this.context || !this.sfxBus) return;
    const buffer = this.generatedBuffers.get(path);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume;
    source.connect(gain);
    if (pan !== 0) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(this.sfxBus);
    } else {
      gain.connect(this.sfxBus);
    }
    source.start(this.context.currentTime + delay);
  }

  private targetMusicGain(): number {
    if (this.mode === "boss") return 0.37;
    if (this.mode === "victory") return 0.34;
    return 0.32;
  }

  private duckMusic(duration: number, depth: number): void {
    if (!this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const target = this.targetMusicGain();
    const ducked = Math.max(0.035, target * depth);
    const current = Math.max(0.0001, this.musicBus.gain.value);
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(current, now);
    this.musicBus.gain.exponentialRampToValueAtTime(ducked, now + 0.045);
    this.musicBus.gain.setValueAtTime(ducked, now + Math.max(0.08, duration * 0.58));
    this.musicBus.gain.exponentialRampToValueAtTime(target, now + duration);
  }

  private startGeneratedMusic(mode: MusicMode): boolean {
    if (!this.context || !this.musicBus) return false;
    const config = MUSIC_TRACKS[mode];
    const buffer = this.generatedBuffers.get(config.path);
    if (!buffer) return false;
    if (this.musicSource && this.activeMusicMode === mode) return true;

    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    const now = this.context.currentTime;
    const previousSource = this.musicSource;
    const previousGain = this.musicSourceGain;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = mode !== "victory";
    source.connect(gain);
    gain.connect(this.musicBus);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.52);
    source.start(now);

    if (previousSource && previousGain) {
      previousGain.gain.cancelScheduledValues(now);
      previousGain.gain.setValueAtTime(Math.max(0.0001, previousGain.gain.value), now);
      previousGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      previousSource.stop(now + 0.52);
    }

    this.musicSource = source;
    this.musicSourceGain = gain;
    this.activeMusicMode = mode;
    source.addEventListener("ended", () => {
      if (this.musicSource !== source) return;
      this.musicSource = null;
      this.musicSourceGain = null;
      this.activeMusicMode = null;
    });
    return true;
  }

  private startAmbience(): void {
    if (!this.context || !this.musicBus || this.ambienceSource) return;
    const buffer = this.generatedBuffers.get(RAIN_AMBIENCE_PATH);
    if (!buffer) {
      this.startRainBed();
      return;
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0.34;
    source.connect(gain);
    gain.connect(this.musicBus);
    source.start();
    this.ambienceSource = source;
  }

  private ready(): boolean {
    return Boolean(this.context && this.sfxBus && this.context.state === "running" && !this.muted && !this.pageHidden);
  }

  private startMusicLoop(): void {
    if (this.musicTimer) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = window.setInterval(() => this.musicTick(), 118);
  }

  private musicTick(): void {
    if (!this.context || !this.musicBus || this.context.state !== "running" || this.muted || this.pageHidden) return;
    const step = this.musicStep++;
    const exploreScale = [110, 130.81, 146.83, 164.81, 196, 220];
    const combatScale = [110, 130.81, 146.83, 174.61, 196, 233.08];
    const scale = this.mode === "boss" ? combatScale : exploreScale;
    const phrase = this.mode === "boss"
      ? [0, 3, 1, 4, 2, 5, 4, 1, 0, 4, 2, 5, 3, 1, 4, 2]
      : [0, -1, 2, -1, 4, -1, 3, -1, 1, -1, 3, -1, 5, -1, 2, -1];
    const index = phrase[step % phrase.length];
    const speedGate = this.mode === "explore" ? step % 2 === 0 : true;

    if (index >= 0 && speedGate) {
      const frequency = scale[index] * (this.mode === "boss" && step % 4 === 3 ? 2 : 1);
      this.pluck(frequency, this.mode === "boss" ? 0.12 : 0.19, this.mode === "boss" ? 0.045 : 0.032);
    }

    const beatRate = this.mode === "explore" ? 8 : this.mode === "combat" ? 4 : 2;
    if (step % beatRate === 0) this.drum(step % (beatRate * 2) === 0 ? 74 : 92, this.mode === "boss" ? 0.08 : 0.045);
    if (this.mode === "boss" && step % 4 === 2) this.noiseTo(this.musicBus, 0.035, 0.025, 5200);
    if (this.mode === "victory" && step % 8 === 0) {
      const chord = step % 16 === 0 ? [261.63, 329.63, 392] : [293.66, 369.99, 440];
      this.chimeTo(this.musicBus, chord, 0.72, 0.028);
    }
  }

  private pluck(frequency: number, duration: number, volume: number): void {
    if (!this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private drum(frequency: number, volume: number): void {
    if (!this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.06);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    delay = 0,
  ): void {
    if (!this.context || !this.sfxBus) return;
    this.toneTo(this.sfxBus, frequency, duration, type, volume, endFrequency, delay);
  }

  private toneTo(
    destination: AudioNode,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    delay = 0,
  ): void {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number, volume: number, type: OscillatorType): void {
    this.tone(from, duration, type, volume, to);
  }

  private chime(frequencies: number[], duration: number, volume: number, delay = 0): void {
    if (!this.sfxBus) return;
    this.chimeTo(this.sfxBus, frequencies, duration, volume, delay);
  }

  private chimeTo(destination: AudioNode, frequencies: number[], duration: number, volume: number, delay = 0): void {
    frequencies.forEach((frequency, index) => {
      this.toneTo(destination, frequency, duration + index * 0.045, "sine", volume / Math.sqrt(frequencies.length), frequency * 0.995, delay + index * 0.028);
    });
  }

  private noise(duration: number, volume: number, cutoff: number, delay = 0): void {
    if (!this.sfxBus) return;
    this.noiseTo(this.sfxBus, duration, volume, cutoff, delay);
  }

  private noiseTo(destination: AudioNode, duration: number, volume: number, cutoff: number, delay = 0): void {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(now, Math.random() * 0.4);
    source.stop(now + duration + 0.02);
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.context) throw new Error("Audio context is not initialized");
    const length = Math.floor(this.context.sampleRate * 2);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.78 + white * 0.22;
      data[index] = previous;
    }
    return buffer;
  }

  private startRainBed(): void {
    if (!this.context || !this.noiseBuffer || !this.musicBus) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "highpass";
    filter.frequency.value = 1200;
    gain.gain.value = 0.017;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    source.start();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
