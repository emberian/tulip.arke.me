/**
 * Users store - lookup for user names by ID
 */

import {writable, get} from "svelte/store";

export interface UserInfo {
    user_id: number;
    full_name: string;
    avatar_url: string | null;
}

function createUsersStore() {
    const {subscribe, set} = writable<Map<number, UserInfo>>(new Map());

    return {
        subscribe,
        initialize(userList: UserInfo[]) {
            // Ensure user_id is a number for consistent Map keys
            set(new Map(userList.map((u) => [Number(u.user_id), u])));
        },
        getUser(userId: number | string): UserInfo | undefined {
            return get({subscribe}).get(Number(userId));
        },
        getUserName(userId: number | string): string {
            const user = get({subscribe}).get(Number(userId));
            return user?.full_name ?? `User #${userId}`;
        },
    };
}

export const users = createUsersStore();

/**
 * Format whisper recipients with actual names
 */
export function formatWhisperRecipientsWithNames(
    recipients: {user_ids?: number[]; group_ids?: number[]} | null | undefined,
): string {
    if (!recipients) return "whisper";

    const parts: string[] = [];

    if (recipients.user_ids?.length) {
        const names = recipients.user_ids.map((id) => users.getUserName(id));
        if (names.length <= 3) {
            parts.push(names.join(", "));
        } else {
            parts.push(`${names.slice(0, 2).join(", ")} +${names.length - 2} more`);
        }
    }

    if (recipients.group_ids?.length) {
        parts.push(`${recipients.group_ids.length} group(s)`);
    }

    return parts.length > 0 ? `to ${parts.join(", ")}` : "whisper";
}
