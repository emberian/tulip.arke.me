<script lang="ts">
    import type {CastMember} from "../stores/presence";

    interface Props {
        members: Map<number, CastMember>;
    }

    let {members}: Props = $props();

    // Sort: active first, then idle, then offline
    let sortedMembers = $derived(
        Array.from(members.values()).sort((a, b) => {
            const statusOrder = {active: 0, idle: 1, offline: 2};
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;
            return a.full_name.localeCompare(b.full_name);
        }),
    );

    function getInitials(name: string): string {
        return name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    }
</script>

<section class="cast-list" aria-label="Cast members">
    <h3 id="cast-list-heading">Cast</h3>

    <ul aria-labelledby="cast-list-heading" class="cast-members-list">
        {#each sortedMembers as member}
            {@const statusLabel = member.status === "active" ? "Online" : member.status === "idle" ? "Away" : "Offline"}
            <li class="cast-member">
                <span
                    class="status-indicator {member.status}"
                    role="img"
                    aria-label={statusLabel}
                    title={statusLabel}
                ></span>
                {#if member.avatar_url}
                    <img
                        class="cast-avatar"
                        src={member.avatar_url}
                        alt=""
                        aria-hidden="true"
                    />
                {:else}
                    <div class="cast-avatar-placeholder" aria-hidden="true">
                        {getInitials(member.full_name)}
                    </div>
                {/if}
                <div class="cast-info">
                    <span class="cast-name">
                        {member.active_persona?.name ?? member.full_name}
                    </span>
                    {#if member.active_persona}
                        <span class="cast-real-name">({member.full_name})</span>
                    {/if}
                </div>
            </li>
        {:else}
            <li class="no-cast">No one here yet</li>
        {/each}
    </ul>
</section>

<style>
    .cast-list {
        padding: 1rem;
        flex: 1;
        overflow-y: auto;
    }

    .cast-list h3 {
        font-family: var(--theater-font-ui);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--theater-muted);
        margin-bottom: 0.75rem;
    }

    .cast-members-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .cast-member {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem;
        border-radius: 6px;
        transition: background var(--theater-transition-fast);
    }

    .cast-member:hover {
        background: var(--theater-bg-elevated);
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-indicator.active {
        background: #4ade80;
    }

    .status-indicator.idle {
        background: #fbbf24;
    }

    .status-indicator.offline {
        background: var(--theater-muted);
    }

    .cast-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    .cast-avatar-placeholder {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--theater-bg-elevated);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--theater-muted);
        flex-shrink: 0;
    }

    .cast-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .cast-name {
        font-family: var(--theater-font-ui);
        font-size: 0.85rem;
        color: var(--theater-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cast-real-name {
        font-size: 0.7rem;
        color: var(--theater-muted);
    }

    .no-cast {
        color: var(--theater-muted);
        font-size: 0.85rem;
        font-style: italic;
    }
</style>
