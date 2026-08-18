## 📌 Summary
Fixes #9

Implements **Etapa 2 (Construcción del Mundo)**: Placement, movement, and removal of floor objects, multi-tile structures across layers 3 and 4, and interactive doors with blocking state synchronization.

---

## 🛠️ Key Implementation Details

1. **Floor Objects (`placeMapObject`, `removeMapObject`)**:
   - Validates `objIndex` against the active catalog in `game_objects` before placement.
   - Enforces coordinates within map bounds (`1..MAP_SIZE`).
   - Supports atomic updates and placement tracking in `game_map_tile_overrides`.

2. **Multi-Tile Structures (`placeStructure`)**:
   - Atomically places composite structures (buildings, decor) across upper layers (3 and 4).
   - Wrapped in a database transaction (`BEGIN...COMMIT / ROLLBACK`) to prevent partial placement.
   - Rejects coordinates and offsets that exceed map boundaries.

3. **Door State & Collision Management (`setDoorState`)**:
   - Toggles visual state between `openGrhIndex` and `closedGrhIndex`.
   - Automatically synchronizes tile collision: `blocked: true` when closed, `blocked: false` when open.

---

## 🧪 Verification & Testing

- [x] Added automated unit tests in `api/src/tests/worldBuilder.unit.test.ts`.
- [x] Verified coordinate validation and schema parsing.
- [x] Verified structure multi-tile atomic placement logic.
- [x] Verified door state toggle & collision blocking rules.
- [x] TypeScript build and linter pass cleanly.

---

## 🤝 Bounty Reference
Addresses bounty issue [#9 (Etapa 2: colocacion de objetos, estructuras y puertas)](https://github.com/Bitcoindefi/OpenAO/issues/9) under the **GrantFox OSS** reward program.
