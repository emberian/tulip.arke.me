/**
 * Navigation store - tracks current stream/topic selection
 * Syncs with URL hash for shareable links and browser navigation
 */

import {writable} from "svelte/store";

export interface StreamInfo {
    stream_id: number;
    name: string;
    color: string;
}

export interface NavigationState {
    streams: StreamInfo[];
    currentStreamId: number | null;
    currentTopic: string | null;
}

/**
 * Parse URL hash to extract stream ID and topic
 * Format: #stream/123/scene/Topic%20Name
 */
function parseHash(): {streamId: number | null; topic: string | null} {
    if (typeof window === "undefined") {
        return {streamId: null, topic: null};
    }

    const hash = window.location.hash.slice(1); // Remove leading #
    if (!hash) {
        return {streamId: null, topic: null};
    }

    // Format: stream/123/scene/Topic%20Name
    const match = hash.match(/^stream\/(\d+)\/scene\/(.+)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
        const streamId = parseInt(match[1], 10);
        const topic = decodeURIComponent(match[2]);
        return {streamId, topic};
    }

    return {streamId: null, topic: null};
}

/**
 * Build URL hash from stream ID and topic
 */
function buildHash(streamId: number | null, topic: string | null): string {
    if (streamId === null || topic === null) {
        return "";
    }
    return `#stream/${streamId}/scene/${encodeURIComponent(topic)}`;
}

/**
 * Update browser URL without triggering navigation
 */
function updateUrl(streamId: number | null, topic: string | null, replace = false): void {
    if (typeof window === "undefined") return;

    const hash = buildHash(streamId, topic);
    const newUrl = window.location.pathname + hash;

    if (replace) {
        window.history.replaceState(null, "", newUrl);
    } else {
        window.history.pushState(null, "", newUrl);
    }
}

function createNavigationStore() {
    const {subscribe, set, update} = writable<NavigationState>({
        streams: [],
        currentStreamId: null,
        currentTopic: null,
    });

    // Track if we're handling a popstate to avoid pushing duplicate history
    let handlingPopstate = false;

    return {
        subscribe,

        setStreams(streams: StreamInfo[]) {
            update((state) => ({...state, streams}));
        },

        /**
         * Set current scene and update URL
         * @param streamId Stream ID
         * @param topic Topic name
         * @param options.replaceHistory Replace current history entry instead of pushing
         * @param options.fromUrl Don't update URL (already set from URL)
         */
        setCurrentScene(
            streamId: number | null,
            topic: string | null,
            options: {replaceHistory?: boolean; fromUrl?: boolean} = {},
        ) {
            update((state) => ({
                ...state,
                currentStreamId: streamId,
                currentTopic: topic,
            }));

            // Update URL unless this was triggered by URL change
            if (!options.fromUrl && !handlingPopstate) {
                updateUrl(streamId, topic, options.replaceHistory);
            }
        },

        /**
         * Initialize from URL hash (call on mount)
         */
        initFromUrl() {
            const {streamId, topic} = parseHash();
            if (streamId !== null && topic !== null) {
                this.setCurrentScene(streamId, topic, {fromUrl: true});
            }
        },

        /**
         * Handle browser back/forward navigation
         */
        handlePopstate() {
            handlingPopstate = true;
            const {streamId, topic} = parseHash();
            this.setCurrentScene(streamId, topic, {fromUrl: true});
            handlingPopstate = false;
        },

        reset() {
            set({
                streams: [],
                currentStreamId: null,
                currentTopic: null,
            });
        },
    };
}

export const navigation = createNavigationStore();
