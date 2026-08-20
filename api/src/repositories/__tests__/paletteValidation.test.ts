import { describe, it, expect } from "vitest";
import {
    paletteEntrySchema,
    UPLOADED_GRAPHIC_INDEX_START,
} from "../worldBuilder";

describe("Palette Entry Schema and Validation (#6)", () => {
    it("should accept valid multi-layer palette entries with blocking flag", () => {
        const valid = paletteEntrySchema.safeParse({
            graphics: [5500, 581],
            blocked: true,
        });
        expect(valid.success).toBe(true);
        if (valid.success) {
            expect(valid.data.graphics).toEqual([5500, 581]);
            expect(valid.data.blocked).toBe(true);
        }
    });

    it("should reject palette entries with empty graphics array", () => {
        const invalid = paletteEntrySchema.safeParse({
            graphics: [],
            blocked: false,
        });
        expect(invalid.success).toBe(false);
    });

    it("should reject palette entries exceeding maximum layers (4)", () => {
        const invalid = paletteEntrySchema.safeParse({
            graphics: [1, 2, 3, 4, 5],
        });
        expect(invalid.success).toBe(false);
    });

    it("should enforce non-colliding reserved range for uploaded graphics", () => {
        expect(UPLOADED_GRAPHIC_INDEX_START).toBe(1_000_000);
        // Original game graphics reach up to 320151, well below 1_000_000
        expect(UPLOADED_GRAPHIC_INDEX_START).toBeGreaterThan(320151);
    });
});
