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
    durationMs: 54_000,
    prompt: [
      "Instrumental music for the entrance and battle of an overwhelmingly powerful final boss",
      "in a premium dark Japanese 2D action RPG. Extremely menacing, colossal and relentless.",
      "A brutal 168 BPM hybrid orchestral boss theme in a dark Phrygian minor mode:",
      "earth-shaking taiko ensemble, huge cinematic bass drums, rapid low-string ostinato,",
      "monstrous low brass, pipe organ, distorted industrial bass pulses, ritual bells,",
      "sharp shakuhachi-like screams and dissonant high strings.",
      "Open immediately with a gigantic three-hit boss motif that announces an impossible enemy.",
      "Keep constant combat pressure, add heavier percussion and brass every eight bars,",
      "and make the final section feel apocalyptic. The boss must sound dominant and terrifying.",
      "No vocals, no lyrics, no cheerful heroic melody, no retro chiptune, no soft or quiet breakdown.",
      "Dense premium console-game mix with very powerful drums and controlled sub bass.",
      "End in a way that can return to the opening downbeat without a long fade.",
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
      "One unmistakable premium anime ultimate cut-in sound: SHAAA-KIIN.",
      "A single long razor-sharp katana draw and brilliant crystalline metal ring,",
      "with a fast cyan digital sweep and one compact cinematic bass accent.",
      "Clean attack, bright sustained steel tail, elegant but forceful.",
      "No extra hits, no voice, no melody, no comedy, no boing.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-gmk.mp3",
    durationSeconds: 1.5,
    prompt: [
      "One louder premium anime sword heroine ultimate cut-in sound: SHAAA-KIIN.",
      "A single aggressive katana flash with a golden energy crack, a long ringing steel resonance,",
      "a forceful air slice and one deep sub-bass accent. Stronger than the previous support cut-in.",
      "No repeated hits, no voice, no music, no cartoon tone.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/cutin-linked.mp3",
    durationSeconds: 1.65,
    prompt: [
      "The third and strongest SHAAA-KIIN in a three-step anime ultimate sequence.",
      "One enormous crossed-blade flash as cyan and gold energy collide,",
      "a piercing metallic ring with a long expensive crystalline tail,",
      "and the deepest cinematic bass accent of all three cut-ins.",
      "No explosion yet, no repeated impacts, no voice, no song, no cartoon sound.",
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
    output: "public/assets/audio/sfx/linked-rush-hit.mp3",
    durationSeconds: 0.52,
    prompt: [
      "One compact devastating DO-GA hit for a rapid anime combined-attack barrage.",
      "An immediate heavy body impact layered with a short sword crack, punchy low-frequency slam,",
      "small stone debris and a very short tail so it can be repeated seven times quickly.",
      "No wind-up, no silence, no final explosion, no voice, no music, no comedy.",
    ].join(" "),
  },
  {
    kind: "sfx",
    output: "public/assets/audio/sfx/linked-finisher.mp3",
    durationSeconds: 2.8,
    prompt: [
      "Premium anime action RPG combined-attack final impact.",
      "Start immediately with a colossal BOOOOM after a seven-hit barrage:",
      "crossed-katana thunder crack, enormous layered explosion, collapsing stone,",
      "massive sub-bass shockwave, ringing steel, crystalline energy shards,",
      "and a long majestic golden-cyan tail. The biggest sound in the game.",
      "No silence or wind-up, voice, music, cartoon sound, distortion or clipping.",
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

const requested = new Set(process.argv.slice(2));
const selectedAssets = requested.size === 0
  ? assets
  : assets.filter((asset) => {
      const filename = asset.output.split("/").at(-1);
      return requested.has(asset.output) || (filename ? requested.has(filename) : false);
    });
if (selectedAssets.length === 0) {
  throw new Error(`No matching audio assets: ${[...requested].join(", ")}`);
}

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
  for (const asset of selectedAssets) {
    await generate(asset);
  }
} catch (error) {
  for (const asset of selectedAssets) {
    await rm(`${resolve(root, asset.output)}.generated`, { force: true });
  }
  throw error;
}
