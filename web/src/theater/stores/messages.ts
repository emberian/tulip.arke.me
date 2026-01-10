/**
 * Messages store for Theater Mode
 */

import {writable, derived} from "svelte/store";

import {formatWhisperRecipientsWithNames} from "./users";

export interface WhisperRecipients {
    user_ids?: number[];
    group_ids?: number[];
}

export interface TheaterMessage {
    id: number;
    type: "stream" | "private";
    sender_id: number;
    sender_full_name: string;
    sender_email: string;
    avatar_url: string | null;
    content: string;
    rendered_content: string;
    timestamp: number;

    // Stream messages
    stream_id?: number;
    topic?: string;

    // Persona fields (user-owned character)
    persona_id?: number;
    persona_display_name?: string;
    persona_avatar_url?: string;
    persona_color?: string;

    // Puppet fields (bot-controlled)
    puppet_display_name?: string;
    puppet_avatar_url?: string;

    // Whisper
    whisper_recipients?: WhisperRecipients | null;

    // Computed for theater display
    characterName: string;
    characterAvatar: string | null;
    characterColor: string | null;
    isWhisper: boolean;
    whisperRecipientsText?: string;
    isRead: boolean;

    // For grouping
    streamId: number;
}

function createMessageStore() {
    const {subscribe, set, update} = writable<TheaterMessage[]>([]);

    return {
        subscribe,
        setMessages(msgs: TheaterMessage[]) {
            set(msgs);
        },
        addMessage(msg: TheaterMessage) {
            update((messages) => {
                // Insert in sorted order by id
                const newMessages = [...messages, msg];
                newMessages.sort((a, b) => a.id - b.id);
                return newMessages;
            });
        },
        addMessages(msgs: TheaterMessage[]) {
            update((messages) => {
                const combined = [...messages, ...msgs];
                combined.sort((a, b) => a.id - b.id);
                // Deduplicate by id
                const seen = new Set<number>();
                return combined.filter((m) => {
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                });
            });
        },
        prependMessages(msgs: TheaterMessage[]) {
            update((messages) => {
                const combined = [...msgs, ...messages];
                combined.sort((a, b) => a.id - b.id);
                // Deduplicate
                const seen = new Set<number>();
                return combined.filter((m) => {
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                });
            });
        },
        updateMessage(id: number, updates: Partial<TheaterMessage>) {
            update((messages) => messages.map((m) => (m.id === id ? {...m, ...updates} : m)));
        },
        removeMessage(id: number) {
            update((messages) => messages.filter((m) => m.id !== id));
        },
        markAsRead(id: number) {
            update((messages) => messages.map((m) => (m.id === id ? {...m, isRead: true} : m)));
        },
        clear() {
            set([]);
        },
    };
}

export const messages = createMessageStore();

/**
 * Derived store: messages grouped by topic (scenes)
 */
export const scenes = derived(messages, ($messages) => {
    const grouped = new Map<string, TheaterMessage[]>();

    for (const msg of $messages) {
        if (msg.type !== "stream" || !msg.stream_id || !msg.topic) continue;
        const key = `${msg.stream_id}:${msg.topic}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.push(msg);
        } else {
            grouped.set(key, [msg]);
        }
    }

    return grouped;
});

/**
 * Helper to convert raw API message to TheaterMessage
 */
export function toTheaterMessage(raw: Record<string, unknown>): TheaterMessage {
    const personaName = raw["persona_display_name"] as string | undefined;
    const puppetName = raw["puppet_display_name"] as string | undefined;
    const senderName = raw["sender_full_name"] as string;

    const personaAvatar = raw["persona_avatar_url"] as string | undefined;
    const puppetAvatar = raw["puppet_avatar_url"] as string | undefined;
    const senderAvatar = raw["avatar_url"] as string | null;

    const personaColor = raw["persona_color"] as string | undefined;

    const whisperRecipients = raw["whisper_recipients"] as WhisperRecipients | null | undefined;
    const isWhisper = whisperRecipients !== null && whisperRecipients !== undefined;

    const flags = (raw["flags"] as string[] | undefined) ?? [];
    const isRead = flags.includes("read");
    const streamId = raw["stream_id"] as number;

    const topic = (raw["subject"] ?? raw["topic"]) as string | undefined;
    const personaId = raw["persona_id"] as number | undefined;

    return {
        id: raw["id"] as number,
        type: raw["type"] as "stream" | "private",
        sender_id: raw["sender_id"] as number,
        sender_full_name: senderName,
        sender_email: raw["sender_email"] as string,
        avatar_url: senderAvatar,
        content: raw["content"] as string,
        rendered_content: (raw["rendered_content"] ?? raw["content"]) as string,
        timestamp: raw["timestamp"] as number,
        stream_id: streamId,
        streamId,
        // Only include topic if defined (for exactOptionalPropertyTypes)
        ...(topic !== undefined && {topic}),
        ...(personaId !== undefined && {persona_id: personaId}),
        ...(personaName !== undefined && {persona_display_name: personaName}),
        ...(personaAvatar !== undefined && {persona_avatar_url: personaAvatar}),
        ...(personaColor !== undefined && {persona_color: personaColor}),
        ...(puppetName !== undefined && {puppet_display_name: puppetName}),
        ...(puppetAvatar !== undefined && {puppet_avatar_url: puppetAvatar}),
        // whisper_recipients can be null or WhisperRecipients, not undefined
        whisper_recipients: whisperRecipients ?? null,
        // Computed fields: prefer persona > puppet > sender
        characterName: personaName ?? puppetName ?? senderName,
        characterAvatar: personaAvatar ?? puppetAvatar ?? senderAvatar,
        characterColor: personaColor ?? null,
        isWhisper,
        ...(isWhisper && {whisperRecipientsText: formatWhisperRecipientsWithNames(whisperRecipients)}),
        isRead,
    };
}
