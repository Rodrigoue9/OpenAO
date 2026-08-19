import assert from "node:assert/strict";
import { test } from "vitest";
import { resetAllCharactersConnectedStatus } from "../repositories/characters";
import { resetAllArenaRoomMembersConnectedStatus } from "../repositories/arenas";

test("resetAllCharactersConnectedStatus and resetAllArenaRoomMembersConnectedStatus return numeric counts", async () => {
    const [updatedCharacters, updatedArenaMembers] = await Promise.all([
        resetAllCharactersConnectedStatus(),
        resetAllArenaRoomMembersConnectedStatus(),
    ]);

    assert.equal(typeof updatedCharacters, "number");
    assert.equal(typeof updatedArenaMembers, "number");
    assert.equal(updatedCharacters >= 0, true);
    assert.equal(updatedArenaMembers >= 0, true);
});
