/**
 * API client for Theater Mode
 * Thin wrapper around the Zulip REST API
 */

import type {Persona} from "../stores/personas";

// Get CSRF token from cookie
function getCsrfToken(): string {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match?.[1] ?? "";
}

async function apiRequest<T>(
    method: string,
    url: string,
    data?: Record<string, unknown>,
): Promise<T> {
    const headers: HeadersInit = {
        "X-CSRFToken": getCsrfToken(),
    };

    let body: BodyInit | null = null;
    if (data && method !== "GET") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
            }
        }
        body = params.toString();
    }

    let fullUrl = url;
    if (data && method === "GET") {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
            }
        }
        fullUrl = `${url}?${params.toString()}`;
    }

    const response = await fetch(fullUrl, {
        method,
        headers,
        body,
        credentials: "same-origin",
    });

    const json = await response.json();

    if (!response.ok) {
        const errorMsg = json?.msg || json?.message || `${response.status} ${response.statusText}`;
        console.error("API error:", json);
        throw new Error(errorMsg);
    }

    return json as T;
}

/**
 * Fetch messages for a stream/topic narrow
 */
export interface FetchMessagesParams {
    anchor: number | "newest" | "oldest";
    num_before: number;
    num_after: number;
    narrow: Array<{operator: string; operand: string | number}>;
}

export interface FetchMessagesResult {
    messages: Array<Record<string, unknown>>;
    found_anchor: boolean;
    found_newest: boolean;
    found_oldest: boolean;
}

export async function fetchMessages(params: FetchMessagesParams): Promise<FetchMessagesResult> {
    return apiRequest<FetchMessagesResult>("GET", "/json/messages", {
        anchor: params.anchor,
        num_before: params.num_before,
        num_after: params.num_after,
        narrow: params.narrow,
        client_gravatar: true,
        apply_markdown: true,
    });
}

/**
 * Send a message
 */
export interface SendMessageParams {
    type: "stream" | "private";
    to: string | number;
    content: string;
    topic?: string;
    queue_id?: string;
    local_id?: string;
    // Persona
    persona_id?: number;
    // Whisper
    whisper_to_user_ids?: number[];
    whisper_to_group_ids?: number[];
}

export interface SendMessageResult {
    id: number;
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const data: Record<string, unknown> = {
        type: params.type,
        to: params.to,
        content: params.content,
    };

    if (params.topic) data["topic"] = params.topic;
    if (params.queue_id) data["queue_id"] = params.queue_id;
    if (params.local_id) data["local_id"] = params.local_id;
    if (params.persona_id) data["persona_id"] = params.persona_id;
    if (params.whisper_to_user_ids?.length) {
        data["whisper_to_user_ids"] = params.whisper_to_user_ids;
    }
    if (params.whisper_to_group_ids?.length) {
        data["whisper_to_group_ids"] = params.whisper_to_group_ids;
    }

    return apiRequest<SendMessageResult>("POST", "/json/messages", data);
}

/**
 * Fetch user's personas
 */
export async function fetchPersonas(): Promise<Persona[]> {
    const result = await apiRequest<{personas: Persona[]}>("GET", "/json/users/me/personas");
    return result.personas;
}

/**
 * Fetch topics for a stream
 */
export interface Topic {
    name: string;
    max_id: number;
}

export async function fetchTopics(streamId: number): Promise<Topic[]> {
    const result = await apiRequest<{topics: Topic[]}>("GET", `/json/users/me/${streamId}/topics`);
    return result.topics;
}

/**
 * Send typing notification
 */
export async function sendTypingNotification(
    op: "start" | "stop",
    streamId: number,
    topic: string,
): Promise<void> {
    await apiRequest("POST", "/json/typing", {
        type: "stream",
        op,
        stream_id: streamId,
        topic,
    });
}

/**
 * Mark messages as read
 */
export async function markMessagesRead(messageIds: number[]): Promise<void> {
    await apiRequest("POST", "/json/messages/flags", {
        messages: messageIds,
        op: "add",
        flag: "read",
    });
}
