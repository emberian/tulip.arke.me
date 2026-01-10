import assert from "node:assert/strict";

import type {Page} from "puppeteer";

import * as common from "./lib/common.ts";

async function test_whisper_compose_ui(page: Page): Promise<void> {
    // Open compose box for stream message
    await page.keyboard.press("KeyC");
    await page.waitForSelector("#stream_message_recipient_topic", {visible: true});

    // Need to select a stream first for compose to be valid
    await common.select_stream_in_compose_via_dropdown(page, "Verona");
    await page.type("#stream_message_recipient_topic", "test topic");

    // Wait for the whisper toggle to be visible (it's hidden for DMs)
    await page.waitForSelector(".compose_whisper_toggle", {visible: true});

    // Initially whisper section should be hidden
    const whisper_section = await page.$("#compose-whisper-recipient");
    assert.ok(whisper_section !== null);
    const initial_display = await whisper_section.evaluate((el) =>
        window.getComputedStyle(el).display,
    );
    assert.equal(initial_display, "none");

    // Click whisper toggle to enable whisper mode
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>(".compose_whisper_toggle");
        if (toggle) {
            toggle.click();
        }
    });

    // Wait for whisper section to be shown (use function-based wait)
    await page.waitForFunction(() => {
        const whisper_section = document.querySelector("#compose-whisper-recipient");
        return whisper_section && window.getComputedStyle(whisper_section).display !== "none";
    });

    // Click toggle again to disable whisper mode
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>(".compose_whisper_toggle");
        if (toggle) {
            toggle.click();
        }
    });

    // Wait for whisper section to be hidden
    await page.waitForFunction(() => {
        const whisper_section = document.querySelector("#compose-whisper-recipient");
        return whisper_section && window.getComputedStyle(whisper_section).display === "none";
    });

    // Close compose box
    await page.keyboard.press("Escape");
    await page.waitForSelector("#compose-textarea", {hidden: true});
}

async function test_whisper_recipient_pill(page: Page): Promise<void> {
    // Open compose box
    await page.keyboard.press("KeyC");
    await page.waitForSelector("#stream_message_recipient_topic", {visible: true});

    // Select stream
    await common.select_stream_in_compose_via_dropdown(page, "Verona");
    await page.type("#stream_message_recipient_topic", "whisper test");

    // Enable whisper mode
    await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>(".compose_whisper_toggle");
        if (toggle) {
            toggle.click();
        }
    });

    // Wait for whisper section to be shown
    await page.waitForFunction(() => {
        const whisper_section = document.querySelector("#compose-whisper-recipient");
        return whisper_section && window.getComputedStyle(whisper_section).display !== "none";
    });

    // Add a whisper recipient
    await page.type("#whisper_recipient", "cordelia");
    // Wait for typeahead to appear and select first option
    await page.waitForSelector(".typeahead .active", {visible: true});
    await page.keyboard.press("Enter");

    // Wait for pill to be created
    await page.waitForSelector(".whisper-pill-container .pill", {visible: true});

    // Verify pill contains recipient name
    const pill_text = await page.$eval(".whisper-pill-container .pill", (el) => el.textContent);
    assert.ok(pill_text !== null);
    assert.ok(
        pill_text.toLowerCase().includes("cordelia"),
        `Expected pill to contain "cordelia", got: ${pill_text}`,
    );

    // Close compose box
    await page.keyboard.press("Escape");
    await page.waitForSelector("#compose-textarea", {hidden: true});
}

async function test_whisper_hidden_for_dm(page: Page): Promise<void> {
    // Open DM compose box
    await page.keyboard.press("KeyX");
    await page.waitForSelector("#private_message_recipient", {visible: true});

    // Whisper toggle should not be visible for DMs (check via CSS)
    const toggle_hidden = await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>(".compose_whisper_toggle");
        if (!toggle) return true;
        const style = window.getComputedStyle(toggle);
        return style.display === "none" || style.visibility === "hidden";
    });
    assert.ok(toggle_hidden, "Whisper toggle should be hidden for direct messages");

    // Close compose box
    await page.keyboard.press("Escape");
    await page.waitForSelector("#compose-textarea", {hidden: true});
}

async function whisper_test(page: Page): Promise<void> {
    await common.log_in(page);

    // Navigate to a stream first
    await page.click("#left-sidebar-navigation-list .top_left_all_messages");
    const message_list_id = await common.get_current_msg_list_id(page, true);
    await page.waitForSelector(
        `.message-list[data-message-list-id='${message_list_id}']`,
        {visible: true},
    );

    await test_whisper_compose_ui(page);
    await test_whisper_recipient_pill(page);
    await test_whisper_hidden_for_dm(page);
}

common.run_test(whisper_test);
