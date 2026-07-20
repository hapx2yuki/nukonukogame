import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY is required");
}

const root = resolve(import.meta.dirname, "..");

const assets = [
  {
    kind: "music",
    output: "public/assets/audio/music/boss.mp3",
    durationMs: 48_000,
    prompt: [
      "Instrumental final boss battle music for a premium dark Japanese 2D action RPG.",
      "A relentless 152 BPM hybrid orchestral battle cue in a dark minor key:",
      "thunderous taiko and cinematic percussion, urgent string ostinato, distorted low synth pulse,",
      "aggressive brass stabs, shakuhachi-like breath accents, ritual bells, and a memorable heroic lead.",
      "The enemy must feel overwhelmingly powerful, while the player still feels determined.",
      "Start with an immediate dramatic downbeat, escalate every eight bars, and reach a huge climax.",
      "No vocals, no choir words, no comedy, no retro chiptune, no gentle passages.",
      "Mix for video-game combat: punchy drums, clear mids, controlled bass, seamless loop-like ending",
      "that resolves into the opening downbeat without a long fade.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-open.mp3",
    durationSeconds: 1.25,
    prompt: [
      "Premium anime action game ultimate activation sound.",
      "A razor-sharp metallic unsheathe, two fast crystalline blade shings, a short sub-bass braam,",
      "and a tight reverse whoosh. Immediate, expensive, dramatic, no voice, no cartoon sounds,",
      "no soft boing, clean transient, designed for the first frame of a cinematic cut-in.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-support.mp3",
    durationSeconds: 1.45,
    prompt: [
      "Premium anime game support ultimate cut-in stinger.",
      "A brilliant digital crystalline sweep from left to right, rapid precision metal clicks,",
      "a ceremonial bell strike, and a firm cinematic bass hit.",
      "Elegant but powerful, magical technology, no voice, no melody, no comedy, no boing.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-gmk.mp3",
    durationSeconds: 1.5,
    prompt: [
      "High-impact anime sword heroine ultimate cut-in sound.",
      "Three escalating katana shings, an explosive gold energy flare, a forceful air slice,",
      "and a deep cinematic impact. Sharper and heavier than a normal attack.",
      "No voice, no music, no cartoon tone, premium console action game sound design.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-linked.mp3",
    durationSeconds: 2.25,
    prompt: [
      "Climactic dual-hero combined ultimate cut-in stinger for an anime action RPG.",
      "Two opposing energy sweeps converge into the center, a sequence of brilliant metal blade chimes",
      "rises rapidly, followed by a massive orchestral braam and sub-bass slam.",
      "This is the loudest and most triumphant reveal before the final hit.",
      "No voice, no song, no cartoon sound, extremely polished and cinematic.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/ultimate-impact.mp3",
    durationSeconds: 2.35,
    prompt: [
      "Devastating anime sword ultimate hit, premium action game sound effect.",
      "A lightning-fast blade crack immediately followed by an enormous DO-GAAN explosion,",
      "heavy sub-bass shockwave, metal debris, stone fracture, and a long bright energy tail.",
      "The transient must be huge and satisfying without clipping. No voice, no music, no comedy.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/linked-finisher.mp3",
    durationSeconds: 3.1,
    prompt: [
      "Ultimate combined attack final impact for a premium anime action RPG.",
      "A brief vacuum silence, crossed katana cracks, then a colossal DO-GAAN magical detonation",
      "with layered thunder, massive sub-bass shockwave, ringing steel, crystalline energy shards,",
      "and a majestic golden-cyan tail. The biggest sound in the entire game.",
      "No voice, no music, no cartoon sounds, no distortion or clipping.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/boss-phase-shift.mp3",
    durationSeconds: 2.55,
    prompt: [
      "Terrifying final boss second phase transformation stinger.",
      "Low ritual bell, reversed breath, violent crimson energy eruption, deep orchestral braam,",
      "thunderous taiko hit and a rising metallic scream. Dark Japanese fantasy, dangerous and serious.",
      "No voice, no music phrase, no cartoon sound.",
    ].join(" "),
  },
];

async function generate(asset) {
  const output = resolve(root, asset.output);
  const temporary = `${output}.generated`;
  await mkdir(dirname(output), { recursive: true });

  const endpoint = asset.kind === "music"
    ? "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128"
    : "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";
  const body = asset.kind === "music"
    ? {
        prompt: asset.prompt,
        music_length_ms: asset.durationMs,
        model_id: "music_v1",
        force_instrumental: true,
        store_for_inpainting: false,
      }
    : {
        text: asset.prompt,
        duration_seconds: asset.durationSeconds,
        prompt_influence: 0.56,
        loop: false,
        model_id: "eleven_text_to_sound_v2",
      };

  process.stdout.write(`Generating ${asset.output} ... `);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${asset.output}: ${response.status} ${details}`);
  }

  await writeFile(temporary, Buffer.from(await response.arrayBuffer()), { mode: 0o644 });
  await rename(temporary, output);
  process.stdout.write("done\n");
}

try {
  for (const asset of assets) {
    await generate(asset);
  }
} catch (error) {
  for (const asset of assets) {
    await rm(`${resolve(root, asset.output)}.generated`, { force: true });
  }
  throw error;
}
