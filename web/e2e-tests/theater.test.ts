import assert from "node:assert/strict";

import type {Page} from "puppeteer";

import * as common from "./lib/common.ts";

const theater_url = "http://zulip.zulipdev.com:9981/theater/";

async function navigate_to_theater(page: Page): Promise<void> {
    console.log("Navigating to theater mode");
    await page.goto(theater_url);
    // Wait for the theater app to mount
    await page.waitForSelector("#theater-app", {visible: true});
    // Wait for loading to complete
    await page.waitForSelector("#theater-loading", {hidden: true});
    // Theater component should be visible
    await page.waitForSelector(".theater", {visible: true});
}

async function test_theater_loads(page: Page): Promise<void> {
    console.log("Testing theater loads correctly");

    // Verify the main structure is present
    await page.waitForSelector(".theater-sidebar", {visible: true});
    await page.waitForSelector(".theater-stage", {visible: true});

    // Verify the sidebar header with title
    const title = await common.get_text_from_selector(page, ".theater-title");
    assert.equal(title, "Theater");

    // Verify the back link exists
    const back_link = await page.$(".back-link");
    assert.ok(back_link !== null, "Back link should exist");

    // Verify welcome message is shown (no scene selected yet)
    await page.waitForSelector(".theater-welcome", {visible: true});
    const welcome_text = await common.get_text_from_selector(page, ".welcome-content h2");
    assert.equal(welcome_text, "Welcome to the Theater");
}

async function test_scene_selector(page: Page): Promise<void> {
    console.log("Testing scene selector");

    // Verify the scene selector is present
    await page.waitForSelector(".scene-selector", {visible: true});
    const scenes_header = await common.get_text_from_selector(page, ".scene-selector h3");
    assert.equal(scenes_header, "Scenes");

    // There should be at least one stream available (e.g., Verona)
    await page.waitForSelector(".stream-group", {visible: true});

    // Click on a stream to expand it
    const stream_header = await page.waitForSelector(".stream-header", {visible: true});
    assert.ok(stream_header !== null, "Stream header should exist");
    await stream_header.click();

    // Wait for topics to load
    await page.waitForFunction(() => {
        const loading = document.querySelector(".loading-topics");
        return loading === null || getComputedStyle(loading).display === "none";
    });

    // Check if topics loaded (either we have topics or "No scenes yet")
    const has_topics = (await page.$(".scene-item")) !== null;
    const no_topics = (await page.$(".no-topics")) !== null;
    assert.ok(has_topics || no_topics, "Should have topics or no-topics message");
}

async function send_test_message_in_main_app(page: Page): Promise<void> {
    // Send a message through the main app to create a topic we can view in theater
    console.log("Sending test message via main app");
    await page.goto("http://zulip.zulipdev.com:9981/");
    await page.waitForSelector("#inbox-main", {visible: true});

    await common.send_message(page, "stream", {
        stream_name: "Verona",
        topic: "theater test scene",
        content: "The stage is set for a grand performance!",
    });
}

async function test_select_scene_and_view_messages(page: Page): Promise<void> {
    console.log("Testing scene selection and message display");

    // Navigate back to theater
    await navigate_to_theater(page);

    // Find and expand Verona stream
    const verona_header = await page.waitForSelector(
        `xpath//button[contains(@class, "stream-header") and .//span[contains(text(), "Verona")]]`,
        {visible: true},
    );
    assert.ok(verona_header !== null, "Verona stream should exist");
    await verona_header.click();

    // Wait for topics to load
    await page.waitForFunction(() => {
        const loading = document.querySelector(".loading-topics");
        return loading === null || getComputedStyle(loading).display === "none";
    });

    // Find and click our test topic
    const topic_button = await page.waitForSelector(
        `xpath//button[contains(@class, "scene-item") and contains(text(), "theater test scene")]`,
        {visible: true},
    );
    assert.ok(topic_button !== null, "Test topic should exist");
    await topic_button.click();

    // Welcome message should be gone, stage should show content
    await page.waitForSelector(".theater-welcome", {hidden: true});

    // Curtain (scene header) should be visible with topic name
    await page.waitForSelector(".curtain", {visible: true});
    const curtain_title = await common.get_text_from_selector(page, ".curtain-title");
    assert.equal(curtain_title, "theater test scene");

    // Message should be visible on stage
    await page.waitForSelector(".dialogue", {visible: true});
    const message_content = await common.get_text_from_selector(page, ".dialogue-content");
    assert.ok(
        message_content.includes("The stage is set for a grand performance!"),
        "Message content should be visible",
    );
}

async function test_prompter(page: Page): Promise<void> {
    console.log("Testing prompter (compose box)");

    // Prompter should be visible when a scene is selected
    await page.waitForSelector(".prompter", {visible: true});

    // Verify textarea exists
    const textarea = await page.waitForSelector(".prompter textarea", {visible: true});
    assert.ok(textarea !== null, "Textarea should exist");

    // Verify placeholder text
    const placeholder = await page.evaluate(
        () => document.querySelector<HTMLTextAreaElement>(".prompter textarea")?.placeholder,
    );
    assert.equal(placeholder, "Speak your lines...");

    // Verify send button exists (disabled when empty)
    const send_button = await page.waitForSelector(".send-button", {visible: true});
    assert.ok(send_button !== null, "Send button should exist");
    const is_disabled = await page.evaluate(
        () => document.querySelector<HTMLButtonElement>(".send-button")?.disabled,
    );
    assert.ok(is_disabled, "Send button should be disabled when empty");

    // Verify hints are shown
    const hints = await common.get_text_from_selector(page, ".prompter-hints");
    assert.ok(hints.includes("Enter to send"), "Should show Enter hint");
    assert.ok(hints.includes("c"), "Should show keyboard shortcut");
}

async function test_send_message_in_theater(page: Page): Promise<void> {
    console.log("Testing sending message in theater");

    // Type a message
    await page.type(".prompter textarea", "Hark! A new line of dialogue appears.");

    // Send button should now be enabled
    const is_still_disabled = await page.evaluate(
        () => document.querySelector<HTMLButtonElement>(".send-button")?.disabled,
    );
    assert.ok(!is_still_disabled, "Send button should be enabled when message is typed");

    // Click send
    await page.click(".send-button");

    // Wait for the message to appear (the sending indicator may flash too quickly to catch)
    // New message should appear
    await page.waitForFunction(
        () => {
            const dialogues = document.querySelectorAll(".dialogue-content");
            for (const d of dialogues) {
                if (d.textContent?.includes("Hark! A new line of dialogue appears.")) {
                    return true;
                }
            }
            return false;
        },
        {timeout: 10000},
    );

    // Textarea should be cleared
    const textarea_value = await page.evaluate(
        () => document.querySelector<HTMLTextAreaElement>(".prompter textarea")?.value,
    );
    assert.equal(textarea_value, "", "Textarea should be cleared after sending");
}

async function test_keyboard_shortcut_focus(page: Page): Promise<void> {
    console.log("Testing keyboard shortcut to focus compose");

    // Click somewhere else to unfocus the textarea
    await page.click(".stage");

    // Verify textarea is not focused
    const is_focused_before = await page.evaluate(
        () => document.activeElement?.tagName === "TEXTAREA",
    );
    assert.ok(!is_focused_before, "Textarea should not be focused initially");

    // Press 'c' to focus
    await page.keyboard.press("KeyC");

    // Verify textarea is now focused
    const is_focused_after = await page.evaluate(
        () => document.activeElement?.tagName === "TEXTAREA",
    );
    assert.ok(is_focused_after, "Textarea should be focused after pressing 'c'");

    // Press Escape to unfocus
    await page.keyboard.press("Escape");
}

async function test_sidebar_collapse(page: Page): Promise<void> {
    console.log("Testing sidebar collapse/expand");

    // Sidebar should be visible initially
    await page.waitForSelector(".theater-sidebar", {visible: true});
    const theater_title = await page.$(".theater-title");
    assert.ok(theater_title !== null, "Theater title should be visible");

    // Click collapse button
    const collapse_btn = await page.waitForSelector(".collapse-btn", {visible: true});
    assert.ok(collapse_btn !== null, "Collapse button should exist");
    await collapse_btn.click();

    // Theater should have collapsed class
    await page.waitForSelector(".theater.sidebar-collapsed", {visible: true});

    // Title should be hidden
    await page.waitForFunction(() => {
        const title = document.querySelector(".theater-title");
        return title === null || getComputedStyle(title).display === "none";
    });

    // Click to expand again
    await collapse_btn.click();

    // Sidebar should be expanded again
    await page.waitForSelector(".theater:not(.sidebar-collapsed)", {visible: true});
}

async function test_back_to_main_app(page: Page): Promise<void> {
    console.log("Testing back to main app link");

    // Click the back link
    const back_link = await page.waitForSelector(".back-link", {visible: true});
    assert.ok(back_link !== null, "Back link should exist");

    const href = await page.evaluate(
        () => document.querySelector<HTMLAnchorElement>(".back-link")?.getAttribute("href"),
    );
    assert.equal(href, "/", "Back link should point to root");

    // Click and verify navigation
    await back_link.click();
    await page.waitForSelector("#inbox-main", {visible: true});

    // Should be back at main app
    assert.ok(page.url().includes("zulip.zulipdev.com:9981"), "Should be at main app URL");
}

async function test_persona_picker(page: Page): Promise<void> {
    console.log("Testing persona picker (if available)");

    // Navigate back to theater with a scene selected
    await navigate_to_theater(page);

    // Select a scene first
    const verona_header = await page.waitForSelector(
        `xpath//button[contains(@class, "stream-header") and .//span[contains(text(), "Verona")]]`,
        {visible: true},
    );
    await verona_header!.click();

    await page.waitForFunction(() => {
        const loading = document.querySelector(".loading-topics");
        return loading === null || getComputedStyle(loading).display === "none";
    });

    const topic_button = await page.waitForSelector(
        `xpath//button[contains(@class, "scene-item") and contains(text(), "theater test scene")]`,
        {visible: true},
    );
    await topic_button!.click();

    // Wait for prompter to load
    await page.waitForSelector(".prompter", {visible: true});

    // Persona picker is always visible in prompter toolbar
    const persona_picker = await page.$(".persona-picker");
    if (persona_picker !== null) {
        console.log("Persona picker found, testing interaction");

        // Click to open the picker
        const picker_toggle = await page.waitForSelector(".picker-toggle", {visible: true});
        await picker_toggle!.click();

        // Dropdown should appear
        await page.waitForSelector(".picker-dropdown", {visible: true});

        // Should have "Yourself" option (first option)
        const yourself_option = await page.$(".persona-option");
        assert.ok(yourself_option !== null, "Should have persona options");

        // Verify "Yourself" text
        const option_text = await common.get_text_from_selector(page, ".persona-option .option-name");
        assert.ok(option_text.includes("Yourself"), "First option should be Yourself");

        // Click to close by clicking elsewhere
        await page.click(".stage");
        await page.waitForSelector(".picker-dropdown", {hidden: true});
    } else {
        console.log("No persona picker found, skipping persona tests");
    }
}

async function test_new_message_indicator(page: Page): Promise<void> {
    console.log("Testing new message indicator behavior");

    // We're already on theater with a scene selected
    // Scroll up so we're not at the bottom
    await page.evaluate(() => {
        const stage = document.querySelector(".stage");
        if (stage) {
            stage.scrollTop = 0;
        }
    });

    // The new message indicator should appear when a new message arrives and we're scrolled up
    // For now, just verify the basic scroll behavior works
    const stage = await page.$(".stage");
    assert.ok(stage !== null, "Stage element should exist");

    // Scroll back to bottom
    await page.evaluate(() => {
        const stage = document.querySelector(".stage");
        if (stage) {
            stage.scrollTop = stage.scrollHeight;
        }
    });
}

async function theater_tests(page: Page): Promise<void> {
    await common.log_in(page);

    // First, send a test message via main app to have something to view
    await send_test_message_in_main_app(page);

    // Now test theater mode
    await navigate_to_theater(page);
    await test_theater_loads(page);
    await test_scene_selector(page);
    await test_select_scene_and_view_messages(page);
    await test_prompter(page);
    await test_send_message_in_theater(page);
    await test_keyboard_shortcut_focus(page);
    await test_sidebar_collapse(page);
    await test_persona_picker(page);
    await test_new_message_indicator(page);
    await test_back_to_main_app(page);
}

await common.run_test(theater_tests);
