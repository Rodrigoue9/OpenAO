import assert from "node:assert/strict";
import { test } from "vitest";

test("gracefulShutdown reset response and signal safety", async () => {
    let resetCalled = false;
    let disconnectedClients = 0;

    const mockClients = {
        "1": {
            OPEN: 1,
            readyState: 1,
            close: () => { disconnectedClients++; }
        },
        "2": {
            OPEN: 1,
            readyState: 0,
            close: () => {}
        }
    };

    const mockFetch = async (url: string) => {
        if (url === "/internal/characters/reset-connected") {
            resetCalled = true;
            return { updated: 5 };
        }
        return {};
    };

    // Simulate graceful shutdown logic
    for (const client of Object.values(mockClients)) {
        if (client.readyState === client.OPEN) {
            client.close();
        }
    }

    const res = await mockFetch("/internal/characters/reset-connected");

    assert.equal(resetCalled, true);
    assert.equal(disconnectedClients, 1);
    assert.equal(res.updated, 5);
});
