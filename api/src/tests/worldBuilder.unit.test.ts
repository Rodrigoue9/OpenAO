import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
    mapObjectSchema,
    structurePlacementSchema,
    doorStateSchema,
    MAP_SIZE
} from "../repositories/worldBuilder";

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
