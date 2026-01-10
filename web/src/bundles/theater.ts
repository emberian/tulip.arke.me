/**
 * Theater Mode - Immersive RP Frontend
 *
 * A Svelte-based alternate frontend for roleplay sessions with
 * theatrical styling, large character portraits, and narrative flow.
 */

import "./common.ts";

// Import theater styles
import "../../styles/theater/theater.css";

// Import Svelte app
import {mount} from "svelte";

import Theater from "../theater/Theater.svelte";

document.addEventListener("DOMContentLoaded", () => {
    const loadingEl = document.getElementById("theater-loading");
    const appEl = document.getElementById("theater-app");

    if (!appEl) {
        console.error("Theater app container not found");
        return;
    }

    // Parse page params (same pattern as base_page_params.ts)
    const pageParamsDiv = document.querySelector<HTMLElement>("#page-params");
    if (!pageParamsDiv) {
        throw new Error("Missing #page-params");
    }
    const rawParams = pageParamsDiv.getAttribute("data-params") ?? "{}";
    const params = JSON.parse(rawParams) as Record<string, unknown>;
    pageParamsDiv.remove();

    // Mount Svelte app
    mount(Theater, {
        target: appEl,
        props: {
            pageParams: params,
        },
    });

    // Hide loading indicator
    if (loadingEl) {
        loadingEl.style.display = "none";
    }
});
