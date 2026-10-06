# Tower TD playable build

Godot 4.7.2 cylinder-wall presentation connected to the existing C++ gameplay runtime.

Play after the deployment workflow succeeds: https://kkamibbotto.github.io/tower-td-play/

- Start/retry: Enter or tap the start/result overlay.
- Move around the summit: A/D, arrow keys, or hold LEFT/RIGHT.
- Stone: hold Space / STONE. Shockwave: press E / SHOCK (release before the next cast).
- Pause: P / top bar. Save verified replay: V / top-right.
- Touch supports movement and attacks simultaneously.
- Enemies climb the cylinder wall; stones and shockwaves descend. The radar shows enemies behind the tower.
- Rules12 adds falling-body collisions: a defeated enemy can damage enemies below and trigger a chain. The header shows the best chain.
- Uses risk-playtest-1, seed 1 and 20 simulation ticks/second.
- Rules13 adds eight enemy kinds: grunt, runner, spider, jumper, armor, bomb, boss and queen. Armor blocks the first stone; bombs explode on defeat.
- Rules16 includes XP and upgrade cards, timed boss/queen encounters and finale, and a sealed risk nest with accept/skip and reward choices. Press 1-3 or tap a card to choose; combat pauses while choosing.

This public repository contains the reviewed Web runtime archive and deployment tools.
The original development repository, C++ source, Unreal projects and history are not copied.
Web runtime files and resources are publicly downloadable, as with any browser game.
Third-party notices are shipped with the game as `THIRD_PARTY_NOTICES.txt`.

## Deployment

Pages Source must be GitHub Actions. Push to main or run **Deploy and verify Tower TD**.
The workflow verifies the ZIP SHA256 and exact runtime file list, publishes only the
extracted runtime, then verifies the public URL with real Chromium, replay and touch.
Screenshots/logs are uploaded as workflow evidence. Physical-phone feel is a separate test.

## Updating the game

1. Obtain a successful, reviewed Web build from the private development pipeline.
2. Replace `build/web.zip` and update `build.json` with its SHA256, source commit and file list.
3. Push both together. The public workflow automatically packages, deploys and verifies it.

This repository does not have a token that reads the private development repository.
Transferring a newer approved build is currently an explicit checkpoint, not an automatic
cross-repository sync. No source repository visibility change is required.

## Language / 언어

기본 언어는 한국어입니다. 화면의 언어 버튼 또는 `L` 키로 한국어/영어를 전환합니다.
The default language is Korean. Use the language button or `L` to switch Korean/English.
The verified build includes annotated localization data and the Noto Sans KR font with its SIL OFL license and provenance.
