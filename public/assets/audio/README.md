# 音響素材

2026年7月20日〜21日にElevenLabsの効果音生成APIと音楽生成APIで制作した、ゲーム専用の音響素材です。全29音源を実際の操作・戦闘・演出へ割り当てています。

## BGM・環境音

- `music/explore.mp3`: 探索・物語
- `music/combat.mp3`: 通常戦闘
- `music/boss.mp3`: 強敵感を増したボス戦専用の約50秒楽曲を循環用に整音したもの
- `music/victory.mp3`: ボス撃破後
- `sfx/rain-loop.mp3`: 雨の街の環境音

## プレイヤー操作

- `sfx/slash.mp3`: 通常斬撃
- `sfx/heavy-slash.mp3`: 強斬撃
- `sfx/jump.mp3`: ジャンプ
- `sfx/land.mp3`: 強めの着地
- `sfx/dash.mp3`: 影走り
- `sfx/parry.mp3`: 完全回避・パリー
- `sfx/gadget-magic.mp3`: 日輪符
- `sfx/footstep-wood.mp3`: 木面の足音
- `sfx/footstep-stone.mp3`: 石面の足音
- `sfx/footstep-metal.mp3`: 金属面の足音

## 戦闘・敵

- `sfx/impact-hit.mp3`: 攻撃命中
- `sfx/enemy-defeat.mp3`: 敵撃破
- `sfx/hurt.mp3`: プレイヤー被弾
- `sfx/enemy-cue.mp3`: 敵の攻撃予兆
- `sfx/guard-break.mp3`: 崩し・物体破壊
- `sfx/boss-intro.mp3`: ボス登場・第二形態

## 奥義・カットイン

- `sfx/cutin-kin.mp3`: カットインの二連「キン・キン」
- `sfx/cutin-gmk.mp3`: GMKの奥義カットイン
- `sfx/ultimate.mp3`: GMK
- `sfx/ultimate-impact.mp3`: 奥義命中時の爆発・衝撃
- `sfx/boss-phase-shift.mp3`: ボス第二相への移行
- `sfx/victory-stinger.mp3`: 勝利演出

## 画面操作

- `sfx/ui-select.mp3`: 決定・選択

生成時に使用したAPIキーは、このリポジトリやVercelの環境変数には保存していません。
追加のボス戦音源は `scripts/generate-boss-audio.mjs` で再生成できます。実行時だけ `ELEVENLABS_API_KEY` を環境変数として渡してください。
