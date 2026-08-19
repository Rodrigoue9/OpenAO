import pool from "../db";

export const MAP_SIZE = 100;

export type MapObjectState = "placed" | "structure" | "door_open" | "door_closed" | "sign";

export type MapObjectRecord = {
    id: number;
    mapId: number;
    x: number;
    y: number;
    objIndex: number;
    amount: number;
    state: MapObjectState;
    createdBy: string | null;
    createdAt: string;
};

export type StructureTileInput = {
    x: number;
    y: number;
    objIndex: number;
    amount?: number;
    state?: MapObjectState;
};

function validateCoordinates(x: number, y: number): void {
    if (x < 1 || x > MAP_SIZE || y < 1 || y > MAP_SIZE) {
        throw new Error(`Coordenadas fuera de rango (1-${MAP_SIZE}): (${x}, ${y})`);
    }
}

export async function placeObject(
    mapId: number,
    x: number,
    y: number,
    objIndex: number,
    amount: number = 1,
    createdBy: string | null = null,
    state: MapObjectState = "placed"
): Promise<MapObjectRecord> {
    validateCoordinates(x, y);
    if (objIndex <= 0) {
        throw new Error("objIndex debe ser mayor a 0");
    }

    const res = await pool.query(
        `INSERT INTO game_map_objects (map_id, x, y, obj_index, amount, state, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, map_id AS "mapId", x, y, obj_index AS "objIndex", amount, state, created_by AS "createdBy", created_at AS "createdAt"`,
        [mapId, x, y, objIndex, amount, state, createdBy]
    );
    return res.rows[0];
}

export async function moveObject(id: number, newX: number, newY: number): Promise<MapObjectRecord | null> {
    validateCoordinates(newX, newY);
    const res = await pool.query(
        `UPDATE game_map_objects
         SET x = $1, y = $2
         WHERE id = $3
         RETURNING id, map_id AS "mapId", x, y, obj_index AS "objIndex", amount, state, created_by AS "createdBy", created_at AS "createdAt"`,
        [newX, newY, id]
    );
    return res.rows[0] || null;
}

export async function removeObject(id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM game_map_objects WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
}

export async function getMapObjects(mapId: number): Promise<MapObjectRecord[]> {
    const res = await pool.query(
        `SELECT id, map_id AS "mapId", x, y, obj_index AS "objIndex", amount, state, created_by AS "createdBy", created_at AS "createdAt"
         FROM game_map_objects
         WHERE map_id = $1
         ORDER BY id ASC`,
        [mapId]
    );
    return res.rows;
}

export async function setObjectState(id: number, state: MapObjectState): Promise<MapObjectRecord | null> {
    const res = await pool.query(
        `UPDATE game_map_objects
         SET state = $1
         WHERE id = $2
         RETURNING id, map_id AS "mapId", x, y, obj_index AS "objIndex", amount, state, created_by AS "createdBy", created_at AS "createdAt"`,
        [state, id]
    );
    return res.rows[0] || null;
}

export async function placeStructure(
    mapId: number,
    tiles: StructureTileInput[],
    createdBy: string | null = null
): Promise<MapObjectRecord[]> {
    if (!tiles.length) return [];

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const results: MapObjectRecord[] = [];
        for (const tile of tiles) {
            validateCoordinates(tile.x, tile.y);
            if (tile.objIndex <= 0) {
                throw new Error("objIndex debe ser mayor a 0");
            }
            const res = await client.query(
                `INSERT INTO game_map_objects (map_id, x, y, obj_index, amount, state, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, map_id AS "mapId", x, y, obj_index AS "objIndex", amount, state, created_by AS "createdBy", created_at AS "createdAt"`,
                [mapId, tile.x, tile.y, tile.objIndex, tile.amount ?? 1, tile.state ?? "structure", createdBy]
            );
            results.push(res.rows[0]);
        }
        await client.query("COMMIT");
        return results;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
