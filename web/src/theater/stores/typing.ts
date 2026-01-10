/**
 * Typing store - who's preparing to speak
 */

import {writable, derived} from "svelte/store";

export interface Typist {
    user_id: number;
    full_name: string;
    // If typing as a persona/puppet
    persona_name?: string;
}

// Map of "streamId:topic" -> array of typists
function createTypingStore() {
    const {subscribe, set, update} = writable<Map<string, Typist[]>>(new Map());

    // Timeout handles for auto-clearing stale typing indicators
    const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

    function clearTypistTimeout(key: string, userId: number) {
        const timeoutKey = `${key}:${userId}`;
        const existing = timeouts.get(timeoutKey);
        if (existing) {
            clearTimeout(existing);
            timeouts.delete(timeoutKey);
        }
    }

    function setTypistTimeout(key: string, userId: number) {
        clearTypistTimeout(key, userId);
        const timeoutKey = `${key}:${userId}`;
        // Clear after 15 seconds if no stop event
        const handle = setTimeout(() => {
            removeTypist(key, userId);
        }, 15000);
        timeouts.set(timeoutKey, handle);
    }

    function addTypist(key: string, typist: Typist) {
        update((map) => {
            const newMap = new Map(map);
            const existing = newMap.get(key) ?? [];
            // Don't add duplicates
            if (existing.some((t) => t.user_id === typist.user_id)) {
                return map;
            }
            newMap.set(key, [...existing, typist]);
            return newMap;
        });
        setTypistTimeout(key, typist.user_id);
    }

    function removeTypist(key: string, userId: number) {
        clearTypistTimeout(key, userId);
        update((map) => {
            const existing = map.get(key);
            if (!existing) return map;
            const filtered = existing.filter((t) => t.user_id !== userId);
            const newMap = new Map(map);
            if (filtered.length === 0) {
                newMap.delete(key);
            } else {
                newMap.set(key, filtered);
            }
            return newMap;
        });
    }

    return {
        subscribe,
        addTypist,
        removeTypist,
        getTypists(streamId: number, topic: string): Typist[] {
            let result: Typist[] = [];
            const unsub = subscribe((map) => {
                result = map.get(`${streamId}:${topic}`) ?? [];
            });
            unsub();
            return result;
        },
        clear() {
            // Clear all timeouts
            for (const handle of timeouts.values()) {
                clearTimeout(handle);
            }
            timeouts.clear();
            set(new Map());
        },
    };
}

export const typing = createTypingStore();

/**
 * Derived store for a specific scene's typists
 */
export function typingForScene(streamId: number, topic: string) {
    return derived(typing, ($typing) => $typing.get(`${streamId}:${topic}`) ?? []);
}
