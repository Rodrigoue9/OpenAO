import assert from "node:assert/strict";
import { afterEach, describe, expect, it, vi } from "vitest";
import pool from "../db";
import {
    doorStateSchema,
    mapObjectSchema,
    MAP_SIZE,
    MAX_STRUCTURE_OFFSET,
    placeMapObject,
    placeStructure,
    setDoorState,
    structurePlacementSchema,
} from "../repositories/worldBuilder";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("WorldBuilder Etapa 2 - Schemas & Validations (#9)", () => {
    it("valida colocación de objetos en coordenadas correctas", () => {
        const valid = mapObjectSchema.parse({
            mapNum: 1,
            x: 50,
            y: 50,
            objIndex: 123,
            amount: 5
        });

        assert.equal(valid.mapNum, 1);
        assert.equal(valid.x, 50);
        assert.equal(valid.y, 50);
        assert.equal(valid.objIndex, 123);
        assert.equal(valid.amount, 5);
    });

    it("rechaza coordenadas fuera de limites del mapa", () => {
        assert.throws(() => {
            mapObjectSchema.parse({
                mapNum: 1,
                x: MAP_SIZE + 1,
                y: 10,
                objIndex: 1
            });
        });

        assert.throws(() => {
            mapObjectSchema.parse({
                mapNum: 1,
                x: 0,
                y: 10,
                objIndex: 1
            });
        });
    });

    it("valida estructuras multi-tile en capas 3 y 4", () => {
        const structure = structurePlacementSchema.parse({
            mapNum: 1,
            originX: 10,
            originY: 10,
            tiles: [
                { offsetX: 0, offsetY: 0, layer: 3, grhIndex: 500, blocked: true },
                { offsetX: 1, offsetY: 0, layer: 3, grhIndex: 501, blocked: true },
                { offsetX: 0, offsetY: 1, layer: 4, grhIndex: 502, blocked: false }
            ]
        });

        assert.equal(structure.tiles.length, 3);
        assert.equal(structure.originX, 10);
    });

    it("rechaza estructuras en capas inferiores a 3 (capa 1 o 2)", () => {
        assert.throws(() => {
            structurePlacementSchema.parse({
                mapNum: 1,
                originX: 10,
                originY: 10,
                tiles: [
                    { offsetX: 0, offsetY: 0, layer: 2, grhIndex: 500 }
                ]
            });
        });
    });

    it("rechaza offsets maiores que o mapa antes de abrir transação", () => {
        expect(() =>
            structurePlacementSchema.parse({
                mapNum: 1,
                originX: 10,
                originY: 10,
                tiles: [
                    {
                        offsetX: MAX_STRUCTURE_OFFSET + 1,
                        offsetY: 0,
                        layer: 3,
                        grhIndex: 500,
                    },
                ],
            }),
        ).toThrow();
    });

    it("valida cambio de estado de puerta abierta/cerrada", () => {
        const doorClosed = doorStateSchema.parse({
            mapNum: 1,
            x: 20,
            y: 20,
            isOpen: false,
            openGrhIndex: 101,
            closedGrhIndex: 100
        });

        assert.equal(doorClosed.isOpen, false);
        assert.equal(doorClosed.closedGrhIndex, 100);

        const doorOpen = doorStateSchema.parse({
            mapNum: 1,
            x: 20,
            y: 20,
            isOpen: true,
            openGrhIndex: 101,
            closedGrhIndex: 100
        });

        assert.equal(doorOpen.isOpen, true);
    });
});

describe("WorldBuilder Etapa 2 - repository operations (#9)", () => {
    it("persiste objIndex e amount sem sobrescrever uma camada gráfica", async () => {
        const query = vi
            .spyOn(pool, "query")
            .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 123 }] } as never)
            .mockResolvedValueOnce({ rowCount: 1, rows: [] } as never);

        const result = await placeMapObject(
            {
                mapNum: 1,
                x: 10,
                y: 11,
                objIndex: 123,
                amount: 7,
            },
            "account-id",
        );

        expect(result).toMatchObject({ objIndex: 123, amount: 7 });
        expect(query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("game_map_object_overrides"),
            [1, 10, 11, 123, 7, "account-id"],
        );
    });

    it("rejeita objIndex inexistente antes de persistir", async () => {
        const query = vi
            .spyOn(pool, "query")
            .mockResolvedValueOnce({ rowCount: 0, rows: [] } as never);

        await expect(
            placeMapObject(
                {
                    mapNum: 1,
                    x: 10,
                    y: 11,
                    objIndex: 9999,
                    amount: 1,
                },
                "account-id",
            ),
        ).rejects.toThrow("no existe");
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("confirma atomicamente uma estrutura sem conflito de porta", async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rowCount: 0 })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({});
        const release = vi.fn();
        vi.spyOn(pool, "connect").mockResolvedValue({ query, release } as never);

        await expect(
            placeStructure(
                {
                    mapNum: 1,
                    originX: 20,
                    originY: 30,
                    tiles: [
                        {
                            offsetX: 0,
                            offsetY: 0,
                            layer: 3,
                            grhIndex: 500,
                            blocked: true,
                        },
                    ],
                },
                "account-id",
            ),
        ).resolves.toEqual({ ok: true, tilesPlaced: 1 });

        expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
        expect(query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("game_map_door_overrides"),
            [1, 20, 30],
        );
        expect(query).toHaveBeenNthCalledWith(4, "COMMIT");
        expect(release).toHaveBeenCalledOnce();
    });

    it("faz rollback quando uma estrutura colide com uma porta", async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({});
        const release = vi.fn();
        vi.spyOn(pool, "connect").mockResolvedValue({ query, release } as never);

        await expect(
            placeStructure(
                {
                    mapNum: 1,
                    originX: 20,
                    originY: 30,
                    tiles: [
                        {
                            offsetX: 0,
                            offsetY: 0,
                            layer: 3,
                            grhIndex: 500,
                            blocked: true,
                        },
                    ],
                },
                "account-id",
            ),
        ).rejects.toThrow("colisiona con una puerta");

        expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");
        expect(release).toHaveBeenCalledOnce();
    });

    it("faz rollback quando uma estrutura ultrapassa o mapa", async () => {
        const query = vi.fn().mockResolvedValue({});
        const release = vi.fn();
        vi.spyOn(pool, "connect").mockResolvedValue({ query, release } as never);

        await expect(
            placeStructure(
                {
                    mapNum: 1,
                    originX: MAP_SIZE,
                    originY: 1,
                    tiles: [
                        {
                            offsetX: 1,
                            offsetY: 0,
                            layer: 3,
                            grhIndex: 500,
                            blocked: false,
                        },
                    ],
                },
                "account-id",
            ),
        ).rejects.toThrow("fuera de limites");

        expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
        expect(query).toHaveBeenNthCalledWith(2, "ROLLBACK");
        expect(release).toHaveBeenCalledOnce();
    });

    it("persiste porta fechada com bloqueio sem ocupar a camada 3", async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rowCount: 0 })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({});
        const release = vi.fn();
        vi.spyOn(pool, "connect").mockResolvedValue({ query, release } as never);

        await expect(
            setDoorState(
                {
                    mapNum: 1,
                    x: 20,
                    y: 20,
                    isOpen: false,
                    openGrhIndex: 101,
                    closedGrhIndex: 100,
                },
                "account-id",
            ),
        ).resolves.toEqual({ ok: true, isOpen: false, blocked: true });

        expect(query).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining("game_map_door_overrides"),
            [1, 20, 20, 101, 100, false, true, "account-id"],
        );
        expect(query).toHaveBeenNthCalledWith(4, "COMMIT");
        expect(release).toHaveBeenCalledOnce();
    });
});
