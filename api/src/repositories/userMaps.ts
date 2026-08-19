import pool from "../db";

export const USER_MAP_START_ID = 600;
export const USER_MAP_END_ID = 1999;
export const DEFAULT_MAX_USER_MAPS = 5;

export type UserMapStatus = "draft" | "proposed" | "published" | "archived";

export type UserMapRecord = {
    id: number;
    accountId: number;
    name: string;
    terrain: string;
    zone: string;
    status: UserMapStatus;
    npcCount: number;
    objectCount: number;
    assetBytes: number;
    createdAt: string;
    updatedAt: string;
};

export type UserMapQuota = {
    mapsUsed: number;
    maxMaps: number;
    assetBytesUsed: number;
    maxAssetBytes: number;
    npcCountUsed: number;
    maxNpcCount: number;
    objectCountUsed: number;
    maxObjectCount: number;
};

export async function getUserMapQuota(accountId: number): Promise<UserMapQuota> {
    const res = await pool.query(
        `SELECT COUNT(*)::int AS "mapsCount",
                COALESCE(SUM(asset_bytes), 0)::bigint AS "totalAssetBytes",
                COALESCE(SUM(npc_count), 0)::int AS "totalNpcs",
                COALESCE(SUM(object_count), 0)::int AS "totalObjects"
         FROM user_maps
         WHERE account_id = $1 AND status != 'archived'`,
        [accountId]
    );
    const row = res.rows[0] || {};
    return {
        mapsUsed: row.mapsCount || 0,
        maxMaps: DEFAULT_MAX_USER_MAPS,
        assetBytesUsed: Number(row.totalAssetBytes || 0),
        maxAssetBytes: 10 * 1024 * 1024,
        npcCountUsed: row.totalNpcs || 0,
        maxNpcCount: 20,
        objectCountUsed: row.totalObjects || 0,
        maxObjectCount: 50,
    };
}

export async function checkMapOwnership(mapId: number, accountId: number): Promise<boolean> {
    const res = await pool.query(
        `SELECT 1 FROM user_maps WHERE id = $1 AND account_id = $2`,
        [mapId, accountId]
    );
    return (res.rowCount ?? 0) > 0;
}

export async function createUserMap(
    accountId: number,
    name: string,
    terrain: string = "PRADERA",
    zone: string = "CAMPO"
): Promise<UserMapRecord> {
    const quota = await getUserMapQuota(accountId);
    if (quota.mapsUsed >= quota.maxMaps) {
        throw new Error(`Se ha alcanzado la cuota maxima de mapas (${quota.maxMaps})`);
    }

    const nextIdRes = await pool.query(
        `SELECT COALESCE(MAX(id) + 1, $1) AS "nextId"
         FROM user_maps
         WHERE id >= $1 AND id <= $2`,
        [USER_MAP_START_ID, USER_MAP_END_ID]
    );
    const nextId = Math.max(USER_MAP_START_ID, Number(nextIdRes.rows[0]?.nextId || USER_MAP_START_ID));
    if (nextId > USER_MAP_END_ID) {
        throw new Error("No hay identificadores de mapa disponibles en el rango de usuarios");
    }

    const res = await pool.query(
        `INSERT INTO user_maps (id, account_id, name, terrain, zone, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING id, account_id AS "accountId", name, terrain, zone, status,
                   npc_count AS "npcCount", object_count AS "objectCount",
                   asset_bytes AS "assetBytes", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [nextId, accountId, name.trim(), terrain, zone]
    );
    return res.rows[0];
}

export async function getUserMap(mapId: number): Promise<UserMapRecord | null> {
    const res = await pool.query(
        `SELECT id, account_id AS "accountId", name, terrain, zone, status,
                npc_count AS "npcCount", object_count AS "objectCount",
                asset_bytes AS "assetBytes", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM user_maps
         WHERE id = $1`,
        [mapId]
    );
    return res.rows[0] || null;
}

export async function listUserMaps(accountId: number): Promise<UserMapRecord[]> {
    const res = await pool.query(
        `SELECT id, account_id AS "accountId", name, terrain, zone, status,
                npc_count AS "npcCount", object_count AS "objectCount",
                asset_bytes AS "assetBytes", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM user_maps
         WHERE account_id = $1
         ORDER BY id ASC`,
        [accountId]
    );
    return res.rows;
}

export async function listPublishedUserMaps(page = 1, limit = 20): Promise<{ maps: UserMapRecord[]; total: number }> {
    const offset = (Math.max(1, page) - 1) * limit;
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM user_maps WHERE status = 'published'`);
    const total = countRes.rows[0]?.total || 0;

    const res = await pool.query(
        `SELECT id, account_id AS "accountId", name, terrain, zone, status,
                npc_count AS "npcCount", object_count AS "objectCount",
                asset_bytes AS "assetBytes", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM user_maps
         WHERE status = 'published'
         ORDER BY id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return { maps: res.rows, total };
}

export async function updateUserMapStatus(
    mapId: number,
    accountId: number,
    newStatus: UserMapStatus
): Promise<UserMapRecord | null> {
    const isOwner = await checkMapOwnership(mapId, accountId);
    if (!isOwner) {
        throw new Error("No tienes permiso para modificar este mapa");
    }

    const res = await pool.query(
        `UPDATE user_maps
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND account_id = $3
         RETURNING id, account_id AS "accountId", name, terrain, zone, status,
                   npc_count AS "npcCount", object_count AS "objectCount",
                   asset_bytes AS "assetBytes", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [newStatus, mapId, accountId]
    );
    return res.rows[0] || null;
}
