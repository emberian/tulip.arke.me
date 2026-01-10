<script lang="ts">
    interface Props {
        title: string;
        subtitle?: string;
        isSceneStart?: boolean;
    }

    let {title, subtitle, isSceneStart = false}: Props = $props();
</script>

<header class="curtain" class:scene-start={isSceneStart} aria-label="Scene: {title}">
    <div class="curtain-line" aria-hidden="true"></div>
    <div class="curtain-content">
        <h2 class="curtain-title">{title}</h2>
        {#if subtitle}
            <span class="curtain-subtitle">{subtitle}</span>
        {/if}
    </div>
    <div class="curtain-line" aria-hidden="true"></div>
</header>

<style>
    .curtain {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem 0;
        margin: 1rem 0;
    }

    .curtain.scene-start {
        padding-top: 1rem;
        margin-top: 0;
    }

    .curtain-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(
            90deg,
            transparent,
            var(--theater-border) 20%,
            var(--theater-border) 80%,
            transparent
        );
    }

    .curtain-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .curtain-title {
        font-family: var(--theater-font-display);
        font-size: 1.5rem;
        font-weight: 400;
        color: var(--theater-text);
        margin: 0;
        letter-spacing: 0.05em;
    }

    .curtain-subtitle {
        font-family: var(--theater-font-ui);
        font-size: 0.8rem;
        color: var(--theater-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-top: 0.25rem;
    }
</style>
