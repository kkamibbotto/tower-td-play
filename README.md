# Tower TD playable build

Godot 4.7.2 comparison slice using a shared C++ gameplay runtime.

Play after the deployment workflow succeeds: https://kkamibbotto.github.io/tower-td-play/

- Move/aim: A/D, arrow keys, or drag the arena.
- Stone: Space / STONE. Shockwave: E / SHOCK.
- Pause: P / top bar. Restart: R / top-right.
- Touch supports aiming and attacks simultaneously.

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
