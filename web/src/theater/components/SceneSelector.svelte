<script lang="ts">
    import {createEventDispatcher, onMount} from "svelte";

    import * as api from "../api/client";
    import type {StreamInfo} from "../stores/navigation";

    interface Props {
        streams: StreamInfo[];
        selectedStreamId: number | null;
        selectedTopic: string | null;
    }

    let {streams, selectedStreamId, selectedTopic}: Props = $props();

    const dispatch = createEventDispatcher<{
        sceneChange: {streamId: number; topic: string};
    }>();

    let expandedStreams = $state<Set<number>>(new Set());
    let topicsByStream = $state<Map<number, api.Topic[]>>(new Map());
    let loadingStreams = $state<Set<number>>(new Set());
    let failedStreams = $state<Set<number>>(new Set());

    function toggleStream(streamId: number) {
        const newExpanded = new Set(expandedStreams);
        if (newExpanded.has(streamId)) {
            newExpanded.delete(streamId);
        } else {
            newExpanded.add(streamId);
            loadTopics(streamId);
        }
        expandedStreams = newExpanded;
    }

    async function loadTopics(streamId: number) {
        if (topicsByStream.has(streamId)) return;
        if (loadingStreams.has(streamId)) return;

        loadingStreams = new Set(loadingStreams).add(streamId);
        failedStreams = new Set([...failedStreams].filter((id) => id !== streamId));

        try {
            const topics = await api.fetchTopics(streamId);
            topicsByStream = new Map(topicsByStream).set(streamId, topics);
        } catch (error) {
            console.error("Failed to load topics:", error);
            failedStreams = new Set(failedStreams).add(streamId);
        } finally {
            loadingStreams = new Set([...loadingStreams].filter((id) => id !== streamId));
        }
    }

    function retryLoadTopics(streamId: number) {
        topicsByStream = new Map([...topicsByStream].filter(([id]) => id !== streamId));
        loadTopics(streamId);
    }

    function selectTopic(streamId: number, topic: string) {
        dispatch("sceneChange", {streamId, topic});
    }

    // Auto-expand the stream containing the selected scene
    $effect(() => {
        if (selectedStreamId && !expandedStreams.has(selectedStreamId)) {
            const newExpanded = new Set(expandedStreams);
            newExpanded.add(selectedStreamId);
            expandedStreams = newExpanded;
            loadTopics(selectedStreamId);
        }
    });
</script>

<nav class="scene-selector" aria-label="Scene navigation">
    <h3 id="scene-selector-heading">Scenes</h3>

    <ul role="tree" aria-labelledby="scene-selector-heading" class="stream-tree">
        {#each streams as stream}
            {@const isExpanded = expandedStreams.has(stream.stream_id)}
            {@const isStreamSelected = selectedStreamId === stream.stream_id}
            <li role="treeitem" aria-expanded={isExpanded} aria-selected={isStreamSelected} class="stream-group">
                <button
                    class="stream-header"
                    class:expanded={isExpanded}
                    onclick={() => toggleStream(stream.stream_id)}
                    aria-expanded={isExpanded}
                    aria-controls="topics-{stream.stream_id}"
                >
                    <span class="scene-color" style="background-color: {stream.color}" aria-hidden="true"></span>
                    <span class="stream-name">{stream.name}</span>
                    <span class="expand-icon" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                </button>

                {#if isExpanded}
                    <ul role="group" id="topics-{stream.stream_id}" class="topics-list">
                        {#if loadingStreams.has(stream.stream_id)}
                            <li role="status" class="loading-topics">Loading scenes...</li>
                        {:else if failedStreams.has(stream.stream_id)}
                            <li class="topics-error">
                                <span>Failed to load</span>
                                <button class="retry-btn" onclick={() => retryLoadTopics(stream.stream_id)}>
                                    Retry
                                </button>
                            </li>
                        {:else}
                            {#each topicsByStream.get(stream.stream_id) ?? [] as topic}
                                {@const isActive = selectedStreamId === stream.stream_id && selectedTopic === topic.name}
                                <li role="treeitem" aria-selected={isActive}>
                                    <button
                                        class="scene-item"
                                        class:active={isActive}
                                        onclick={() => selectTopic(stream.stream_id, topic.name)}
                                        aria-current={isActive ? "true" : undefined}
                                    >
                                        {topic.name}
                                    </button>
                                </li>
                            {:else}
                                <li class="no-topics">No scenes yet</li>
                            {/each}
                        {/if}
                    </ul>
                {/if}
            </li>
        {:else}
            <li class="no-scenes">No channels available</li>
        {/each}
    </ul>
</nav>

<style>
    .scene-selector {
        padding: 1rem;
        border-bottom: 1px solid var(--theater-border);
        overflow-y: auto;
        max-height: 50vh;
    }

    .scene-selector h3 {
        font-family: var(--theater-font-ui);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--theater-muted);
        margin-bottom: 0.75rem;
    }

    .stream-tree {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .stream-group {
        margin-bottom: 0.25rem;
        list-style: none;
    }

    .stream-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: none;
        border: none;
        border-radius: 6px;
        color: var(--theater-text);
        cursor: pointer;
        font-family: var(--theater-font-ui);
        font-size: 0.9rem;
        text-align: left;
        transition: background var(--theater-transition-fast);
    }

    .stream-header:hover {
        background: var(--theater-bg-elevated);
    }

    .stream-header.expanded {
        background: var(--theater-bg-elevated);
    }

    .stream-name {
        flex: 1;
    }

    .expand-icon {
        color: var(--theater-muted);
        font-size: 0.8rem;
    }

    .topics-list {
        padding-left: 1.5rem;
        list-style: none;
        margin: 0;
    }

    .scene-item {
        display: block;
        width: 100%;
        padding: 0.4rem 0.75rem;
        background: none;
        border: none;
        border-radius: 4px;
        color: var(--theater-text-secondary);
        cursor: pointer;
        font-family: var(--theater-font-ui);
        font-size: 0.85rem;
        text-align: left;
        transition: all var(--theater-transition-fast);
    }

    .scene-item:hover {
        background: var(--theater-bg);
        color: var(--theater-text);
    }

    .scene-item.active {
        background: var(--theater-accent-dim);
        color: var(--theater-text);
    }

    .scene-color {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex-shrink: 0;
    }

    .loading-topics {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: var(--theater-muted);
        font-style: italic;
    }

    .topics-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: var(--theater-muted);
    }

    .retry-btn {
        background: var(--theater-bg-elevated);
        border: 1px solid var(--theater-border);
        border-radius: 4px;
        color: var(--theater-text);
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        transition: all var(--theater-transition-fast);
    }

    .retry-btn:hover {
        background: var(--theater-accent-dim);
        border-color: var(--theater-accent);
    }

    .no-topics {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: var(--theater-muted);
        font-style: italic;
    }

    .no-scenes {
        color: var(--theater-muted);
        font-size: 0.85rem;
        font-style: italic;
    }
</style>
