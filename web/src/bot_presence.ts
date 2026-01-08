// Bot presence tracking for the sidebar

export type BotPresenceInfo = {
    is_connected: boolean;
    last_connected_time: number | null;
};

// Map of bot_id -> presence info
const bot_presence_info: Map<number, BotPresenceInfo> = new Map();

export function set_info(bot_presences: Record<number, BotPresenceInfo>): void {
    bot_presence_info.clear();
    for (const [bot_id_str, info] of Object.entries(bot_presences)) {
        const bot_id = Number(bot_id_str);
        bot_presence_info.set(bot_id, info);
    }
}

export function update_info(
    bot_id: number,
    is_connected: boolean,
    last_connected_time: number | null | undefined,
): void {
    const existing = bot_presence_info.get(bot_id);
    bot_presence_info.set(bot_id, {
        is_connected,
        // Use server timestamp if provided, otherwise preserve existing
        last_connected_time: last_connected_time ?? existing?.last_connected_time ?? null,
    });
}

export function is_bot_connected(bot_id: number): boolean {
    const info = bot_presence_info.get(bot_id);
    return info?.is_connected ?? false;
}

export function get_info(bot_id: number): BotPresenceInfo | undefined {
    return bot_presence_info.get(bot_id);
}
