<script lang="ts">
    import type {Typist} from "../stores/typing";

    interface Props {
        typists: Typist[];
    }

    let {typists}: Props = $props();

    let displayText = $derived.by(() => {
        if (typists.length === 0) return "";
        if (typists.length === 1) {
            return `${typists[0].full_name} prepares to speak...`;
        }
        if (typists.length === 2) {
            return `${typists[0].full_name} and ${typists[1].full_name} prepare to speak...`;
        }
        return `${typists[0].full_name} and ${typists.length - 1} others prepare to speak...`;
    });
</script>

{#if typists.length > 0}
    <div class="stage-direction" role="status" aria-live="polite" aria-atomic="true">
        <span class="direction-text">{displayText}</span>
        <span class="typing-dots" aria-hidden="true">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </span>
    </div>
{/if}

<style>
    .stage-direction {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-family: var(--theater-font-narrative);
        font-style: italic;
        font-size: 0.95rem;
        color: var(--theater-muted);
    }

    .direction-text {
        opacity: 0.8;
    }

    .typing-dots {
        display: inline-flex;
        gap: 0.2rem;
    }

    .dot {
        width: 4px;
        height: 4px;
        background: var(--theater-muted);
        border-radius: 50%;
        animation: pulse 1.4s infinite ease-in-out;
    }

    .dot:nth-child(1) {
        animation-delay: 0s;
    }

    .dot:nth-child(2) {
        animation-delay: 0.2s;
    }

    .dot:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes pulse {
        0%,
        80%,
        100% {
            opacity: 0.3;
            transform: scale(0.8);
        }
        40% {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
