<script lang="ts">
    import {onMount, tick} from "svelte";

    import * as api from "../api/client";
    import {messages, toTheaterMessage, type TheaterMessage} from "../stores/messages";
    import {typing} from "../stores/typing";

    import Curtain from "./Curtain.svelte";
    import Dialogue from "./Dialogue.svelte";
    import StageDirection from "./StageDirection.svelte";

    interface Props {
        streamId: number;
        topic: string;
        streamName: string;
    }

    let {streamId, topic, streamName}: Props = $props();

    let stageElement: HTMLElement;
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);
    let hasMoreHistory = $state(true);
    let isLoadingMore = $state(false);
    let isNearBottom = $state(true);
    let newMessageCount = $state(0);
    let lastMessageCount = $state(0);

    // Get messages for current scene
    let sceneMessages = $derived(
        $messages
            .filter((m) => m.streamId === streamId && m.topic === topic)
            .sort((a, b) => a.timestamp - b.timestamp),
    );

    // Get typists for current scene
    let typingKey = $derived(`${streamId}:${topic}`);
    let currentTypists = $derived($typing.get(typingKey) ?? []);

    // Group consecutive messages from same speaker
    interface MessageGroup {
        messages: TheaterMessage[];
        speakerId: number;
        speakerName: string;
    }

    let messageGroups = $derived.by(() => {
        const groups: MessageGroup[] = [];

        for (const msg of sceneMessages) {
            const lastGroup = groups[groups.length - 1];

            // Check if this continues the previous speaker
            if (lastGroup && lastGroup.speakerName === msg.characterName) {
                lastGroup.messages.push(msg);
            } else {
                groups.push({
                    messages: [msg],
                    speakerId: msg.sender_id,
                    speakerName: msg.characterName,
                });
            }
        }

        return groups;
    });

    async function loadMessages() {
        isLoading = true;
        loadError = null;
        try {
            const result = await api.fetchMessages({
                anchor: "newest",
                num_before: 50,
                num_after: 0,
                narrow: [
                    {operator: "stream", operand: streamId},
                    {operator: "topic", operand: topic},
                ],
            });

            const theaterMessages = result.messages.map(toTheaterMessage);
            messages.setMessages(theaterMessages);
            hasMoreHistory = !result.found_oldest;

            await tick();
            scrollToBottom();
        } catch (error) {
            console.error("Failed to load messages:", error);
            loadError = "Failed to load messages. Please try again.";
        } finally {
            isLoading = false;
        }
    }

    function retryLoad() {
        loadMessages();
    }

    async function loadMoreHistory() {
        if (isLoadingMore || !hasMoreHistory || sceneMessages.length === 0) return;

        isLoadingMore = true;
        const oldestMessage = sceneMessages[0];
        const scrollHeightBefore = stageElement?.scrollHeight ?? 0;

        try {
            const result = await api.fetchMessages({
                anchor: oldestMessage.id,
                num_before: 30,
                num_after: 0,
                narrow: [
                    {operator: "stream", operand: streamId},
                    {operator: "topic", operand: topic},
                ],
            });

            // Filter out the anchor message
            const newMessages = result.messages
                .filter((m) => (m.id as number) !== oldestMessage.id)
                .map(toTheaterMessage);

            if (newMessages.length > 0) {
                messages.prependMessages(newMessages);
                hasMoreHistory = !result.found_oldest;

                // Maintain scroll position
                await tick();
                const scrollHeightAfter = stageElement?.scrollHeight ?? 0;
                stageElement.scrollTop = scrollHeightAfter - scrollHeightBefore;
            } else {
                hasMoreHistory = false;
            }
        } catch (error) {
            console.error("Failed to load history:", error);
        } finally {
            isLoadingMore = false;
        }
    }

    function scrollToBottom() {
        if (stageElement) {
            stageElement.scrollTop = stageElement.scrollHeight;
            newMessageCount = 0;
        }
    }

    function checkIfNearBottom() {
        if (stageElement) {
            isNearBottom =
                stageElement.scrollHeight - stageElement.scrollTop - stageElement.clientHeight < 100;
            if (isNearBottom) {
                newMessageCount = 0;
            }
        }
    }

    function handleScroll() {
        checkIfNearBottom();
        if (stageElement.scrollTop < 100 && hasMoreHistory && !isLoadingMore) {
            loadMoreHistory();
        }
    }

    function jumpToBottom() {
        scrollToBottom();
        isNearBottom = true;
    }

    // Reload when scene changes
    $effect(() => {
        if (streamId && topic) {
            loadMessages();
            newMessageCount = 0;
            lastMessageCount = 0;
        }
    });

    // Track new messages when scrolled up
    $effect(() => {
        const currentCount = sceneMessages.length;
        if (currentCount > lastMessageCount && lastMessageCount > 0) {
            if (!isNearBottom) {
                newMessageCount += currentCount - lastMessageCount;
            } else {
                tick().then(scrollToBottom);
            }
        }
        lastMessageCount = currentCount;
    });

    onMount(() => {
        // Mark messages as read periodically
        const readInterval = setInterval(() => {
            const unreadIds = sceneMessages.filter((m) => !m.isRead).map((m) => m.id);
            if (unreadIds.length > 0) {
                api.markMessagesRead(unreadIds).catch(() => {});
                for (const id of unreadIds) {
                    messages.markAsRead(id);
                }
            }
        }, 2000);

        return () => clearInterval(readInterval);
    });
</script>

<div
    class="stage"
    bind:this={stageElement}
    onscroll={handleScroll}
    role="log"
    aria-label="Scene messages"
    aria-live="polite"
    aria-relevant="additions"
>
    <Curtain title={topic} subtitle={streamName} isSceneStart={true} />

    {#if isLoading}
        <div class="stage-loading" role="status" aria-live="polite">
            <p>The curtain rises...</p>
        </div>
    {:else if loadError}
        <div class="stage-error" role="alert">
            <p>{loadError}</p>
            <button class="retry-button" onclick={retryLoad}>Try Again</button>
        </div>
    {:else if sceneMessages.length === 0}
        <div class="stage-empty" role="status">
            <p>The stage awaits its first act.</p>
            <p class="stage-empty-hint">Be the first to speak...</p>
        </div>
    {:else}
        {#if isLoadingMore}
            <div class="loading-more" role="status" aria-live="polite">
                <span>Recalling earlier moments...</span>
            </div>
        {/if}

        {#each messageGroups as group, groupIndex}
            {#each group.messages as message, messageIndex}
                <Dialogue
                    {message}
                    showSpeaker={messageIndex === 0}
                    isConsecutive={messageIndex > 0}
                />
            {/each}
        {/each}
    {/if}

    {#if currentTypists.length > 0}
        <StageDirection typists={currentTypists} />
    {/if}
</div>

{#if newMessageCount > 0}
    <button class="new-messages-indicator" onclick={jumpToBottom} aria-label="Jump to new messages">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
        </svg>
        {newMessageCount} new {newMessageCount === 1 ? "message" : "messages"}
    </button>
{/if}

<style>
    .stage {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        scroll-behavior: smooth;
    }

    .stage-loading,
    .stage-empty,
    .stage-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        color: var(--theater-muted);
        font-family: var(--theater-font-narrative);
        font-style: italic;
    }

    .stage-empty p,
    .stage-error p {
        margin: 0.5rem 0;
    }

    .stage-empty-hint {
        font-size: 0.9rem;
        opacity: 0.7;
    }

    .retry-button {
        margin-top: 1rem;
        padding: 0.5rem 1.5rem;
        background: var(--theater-accent);
        border: none;
        border-radius: 6px;
        color: white;
        font-family: var(--theater-font-ui);
        font-size: 0.9rem;
        cursor: pointer;
        transition: background var(--theater-transition-fast);
    }

    .retry-button:hover {
        background: var(--theater-accent-hover);
    }

    .loading-more {
        text-align: center;
        padding: 1rem;
        color: var(--theater-muted);
        font-family: var(--theater-font-ui);
        font-size: 0.85rem;
        font-style: italic;
    }

    .new-messages-indicator {
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: var(--theater-accent);
        border: none;
        border-radius: 20px;
        color: white;
        font-family: var(--theater-font-ui);
        font-size: 0.85rem;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        transition: all var(--theater-transition-fast);
        z-index: 50;
    }

    .new-messages-indicator:hover {
        background: var(--theater-accent-hover);
        transform: translateX(-50%) scale(1.05);
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
        .stage {
            padding: 1rem;
        }

        .new-messages-indicator {
            bottom: 100px;
            padding: 0.5rem 0.85rem;
            font-size: 0.8rem;
        }

        .stage-loading,
        .stage-empty,
        .stage-error {
            min-height: 200px;
            padding: 1rem;
            text-align: center;
        }
    }
</style>
