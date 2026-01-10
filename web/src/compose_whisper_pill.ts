import $ from "jquery";
import assert from "minimalistic-assert";
import _ from "lodash";

import {Typeahead} from "./bootstrap_typeahead.ts";
import type {TypeaheadInputElement} from "./bootstrap_typeahead.ts";
import * as compose_state from "./compose_state.ts";
import * as input_pill from "./input_pill.ts";
import type {User} from "./people.ts";
import * as people from "./people.ts";
import * as personas from "./personas.ts";
import type {Persona} from "./personas.ts";
import * as stream_puppets from "./stream_puppets.ts";
import type {StreamPuppet} from "./stream_puppets.ts";
import type {CombinedPill, CombinedPillContainer, PuppetMention, UserOrMentionPillData} from "./typeahead_helper.ts";
import * as typeahead_helper from "./typeahead_helper.ts";
import type {UserGroupPillData} from "./user_group_pill.ts";
import * as user_group_pill from "./user_group_pill.ts";
import * as user_groups from "./user_groups.ts";
import type {UserGroup} from "./user_groups.ts";
import type {UserPillData} from "./user_pill.ts";
import * as user_pill from "./user_pill.ts";

// Puppet pill type for whisper recipients
export type PuppetPill = {
    type: "puppet";
    puppet_id: number;
    puppet_name: string;
};

// Persona pill type for whisper recipients
export type PersonaPill = {
    type: "persona";
    persona_id: number;
    persona_name: string;
};

// Extended pill type that includes puppets and personas
export type WhisperPill = CombinedPill | PuppetPill | PersonaPill;

export let widget: input_pill.InputPillContainer<WhisperPill> | undefined;

// Current stream ID for puppet lookup (set when composing to a stream)
let current_stream_id: number | undefined;

export function set_current_stream_id(stream_id: number | undefined): void {
    current_stream_id = stream_id;
    // Fetch puppets for this stream if we haven't already
    if (stream_id !== undefined) {
        stream_puppets.fetch_puppets_for_stream(stream_id);
    }
}

function create_item_from_text(
    text: string,
    current_items: WhisperPill[],
): WhisperPill | undefined {
    // Try puppets first (if we have a stream context), then personas, user groups, then users
    if (current_stream_id !== undefined) {
        const puppets = stream_puppets.get_puppets_for_stream(current_stream_id);
        const puppet = puppets.find(
            (p) => p.name.toLowerCase() === text.toLowerCase(),
        );
        if (puppet) {
            // Check if already added
            const already_added = current_items.some(
                (item) => item.type === "puppet" && item.puppet_id === puppet.id,
            );
            if (!already_added) {
                return {
                    type: "puppet",
                    puppet_id: puppet.id,
                    puppet_name: puppet.name,
                };
            }
        }
    }

    // Try personas
    const realm_personas = personas.get_realm_personas();
    const persona = realm_personas.find(
        (p) => p.name.toLowerCase() === text.toLowerCase(),
    );
    if (persona) {
        // Check if already added
        const already_added = current_items.some(
            (item) => item.type === "persona" && item.persona_id === persona.id,
        );
        if (!already_added) {
            return {
                type: "persona",
                persona_id: persona.id,
                persona_name: persona.name,
            };
        }
    }

    // Try user groups and users
    const funcs = [
        user_group_pill.create_item_from_group_name,
        user_pill.create_item_from_user_id,
    ];
    for (const func of funcs) {
        const item = func(text, current_items as CombinedPill[]);
        if (item) {
            return item;
        }
    }
    return undefined;
}

function get_text_from_item(item: WhisperPill): string {
    if (item.type === "puppet") {
        return item.puppet_name;
    }
    if (item.type === "persona") {
        return item.persona_name;
    }
    if (item.type === "user_group") {
        return user_group_pill.get_group_name_from_item(item);
    }
    if (item.type === "user") {
        return user_pill.get_unique_full_name_from_item(item);
    }
    return "";
}

function get_display_value_from_item(item: WhisperPill): string {
    if (item.type === "puppet") {
        return item.puppet_name;
    }
    if (item.type === "persona") {
        return item.persona_name;
    }
    if (item.type === "user_group") {
        const group = user_groups.maybe_get_user_group_from_id(item.group_id);
        if (group) {
            return user_groups.get_display_group_name(group.name);
        }
        return "";
    }
    if (item.type === "user") {
        return user_pill.get_display_value_from_item(item);
    }
    return "";
}

function generate_pill_html(item: WhisperPill): string {
    if (item.type === "puppet") {
        // Use a simple pill style for puppets with a character icon
        // Escape the name to prevent XSS
        return `<span class="pill-value"><i class="zulip-icon zulip-icon-bot" aria-hidden="true"></i> ${_.escape(item.puppet_name)}</span>`;
    }
    if (item.type === "persona") {
        // Use a simple pill style for personas with a user icon
        // Escape the name to prevent XSS
        return `<span class="pill-value"><i class="zulip-icon zulip-icon-user" aria-hidden="true"></i> ${_.escape(item.persona_name)}</span>`;
    }
    if (item.type === "user_group") {
        return user_group_pill.generate_pill_html(item);
    }
    if (item.type === "user") {
        return user_pill.generate_pill_html(item);
    }
    return "";
}

export function initialize_pill(): input_pill.InputPillContainer<WhisperPill> {
    const $container = $("#whisper_recipient").parent();

    const pill = input_pill.create<WhisperPill>({
        $container,
        create_item_from_text,
        get_text_from_item,
        get_display_value_from_item,
        generate_pill_html,
        show_outline_on_invalid_input: true,
    });

    return pill;
}

function get_users(): User[] {
    const all_users = people.get_realm_users();
    if (!widget) {
        return all_users;
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    return user_pill.filter_taken_users(all_users, widget as unknown as CombinedPillContainer);
}

function get_groups(): UserGroup[] {
    let groups = user_groups.get_realm_user_groups();
    groups = groups.filter((item) => item.name !== "role:nobody");
    if (!widget) {
        return groups;
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    return user_group_pill.filter_taken_groups(groups, widget as unknown as CombinedPillContainer);
}

function get_puppets(): StreamPuppet[] {
    if (current_stream_id === undefined) {
        return [];
    }
    const all_puppets = stream_puppets.get_puppets_for_stream(current_stream_id);
    if (!widget) {
        return all_puppets;
    }
    // Filter out already-added puppets
    const current_puppet_ids = new Set(get_puppet_ids());
    return all_puppets.filter((p) => !current_puppet_ids.has(p.id));
}

function get_personas_for_typeahead(): Persona[] {
    // Fetch personas if we haven't already
    if (!personas.has_fetched_realm_personas()) {
        personas.fetch_realm_personas();
    }
    const all_personas = personas.get_realm_personas();
    if (!widget) {
        return all_personas;
    }
    // Filter out already-added personas
    const current_persona_ids = new Set(get_persona_ids());
    return all_personas.filter((p) => !current_persona_ids.has(p.id));
}

// Persona mention type for typeahead
type PersonaMention = {
    id: number;
    name: string;
    avatar_url: string | null;
};

// Type for whisper typeahead items (includes puppets and personas)
type WhisperTypeaheadItem = UserGroupPillData | UserPillData | {type: "puppet"; puppet: PuppetMention} | {type: "persona"; persona: PersonaMention};

function update_compose_state(): void {
    if (!widget) {
        return;
    }

    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    const combined_widget = widget as unknown as CombinedPillContainer;
    const user_ids = user_pill.get_user_ids(combined_widget);
    const group_ids = user_group_pill.get_group_ids(combined_widget);
    const puppet_ids = get_puppet_ids();
    const persona_ids = get_persona_ids();

    compose_state.set_whisper_recipients(user_ids, group_ids, puppet_ids, persona_ids);
}

export function initialize({
    on_pill_create_or_remove,
}: {
    on_pill_create_or_remove: () => void;
}): void {
    widget = initialize_pill();

    // Set up custom typeahead for users, groups, and puppets
    const $pill_container = $("#whisper_recipient").parent();
    const $input = $pill_container.find(".input");

    const bootstrap_typeahead_input: TypeaheadInputElement = {
        $element: $input,
        type: "contenteditable",
    };

    new Typeahead(bootstrap_typeahead_input, {
        dropup: true,
        helpOnEmptyStrings: true,
        hideOnEmptyAfterBackspace: true,
        source(_query: string): WhisperTypeaheadItem[] {
            const source: WhisperTypeaheadItem[] = [];

            // Add user groups
            const groups: UserGroupPillData[] = get_groups().map((user_group) => ({
                type: "user_group" as const,
                ...user_group,
            }));
            source.push(...groups);

            // Add users
            const users: UserPillData[] = get_users().map((user) => ({
                type: "user" as const,
                user,
            }));
            source.push(...users);

            // Add puppets (if we have a stream context)
            const puppets = get_puppets().map((puppet) => ({
                type: "puppet" as const,
                puppet: {
                    id: puppet.id,
                    name: puppet.name,
                    avatar_url: puppet.avatar_url,
                } as PuppetMention,
            }));
            source.push(...puppets);

            // Add personas
            const persona_items = get_personas_for_typeahead().map((persona) => ({
                type: "persona" as const,
                persona: {
                    id: persona.id,
                    name: persona.name,
                    avatar_url: persona.avatar_url,
                } as PersonaMention,
            }));
            source.push(...persona_items);

            return source;
        },
        item_html(item: WhisperTypeaheadItem, _query: string): string {
            if (item.type === "user_group") {
                return typeahead_helper.render_user_group(item);
            }
            if (item.type === "puppet") {
                // Use render_person which handles puppets
                return typeahead_helper.render_person(item as UserOrMentionPillData);
            }
            if (item.type === "persona") {
                // Render persona similar to puppet
                return typeahead_helper.render_person({
                    type: "persona",
                    persona: item.persona,
                } as UserOrMentionPillData);
            }
            assert(item.type === "user");
            return typeahead_helper.render_person(item);
        },
        matcher(item: WhisperTypeaheadItem, query: string): boolean {
            query = query.toLowerCase().replaceAll("\u00A0", " ");

            if (item.type === "user_group") {
                return typeahead_helper.query_matches_group_name(query, item);
            }

            if (item.type === "puppet") {
                return typeahead_helper.query_matches_person(query, item as UserOrMentionPillData);
            }

            if (item.type === "persona") {
                // Match against persona name
                return item.persona.name.toLowerCase().includes(query);
            }

            assert(item.type === "user");
            return typeahead_helper.query_matches_person(query, item);
        },
        sorter(matches: WhisperTypeaheadItem[], query: string): WhisperTypeaheadItem[] {
            const users: UserPillData[] = [];
            const groups: UserGroupPillData[] = [];
            const puppets: WhisperTypeaheadItem[] = [];
            const persona_items: WhisperTypeaheadItem[] = [];

            for (const match of matches) {
                if (match.type === "user") {
                    users.push(match);
                } else if (match.type === "user_group") {
                    groups.push(match);
                } else if (match.type === "puppet") {
                    puppets.push(match);
                } else if (match.type === "persona") {
                    persona_items.push(match);
                }
            }

            // Sort users and groups together, then append puppets and personas
            const sorted = typeahead_helper.sort_stream_or_group_members_options({
                users,
                query,
                groups,
                for_stream_subscribers: false,
            });

            // Sort puppets alphabetically
            puppets.sort((a, b) => {
                if (a.type === "puppet" && b.type === "puppet") {
                    return a.puppet.name.localeCompare(b.puppet.name);
                }
                return 0;
            });

            // Sort personas alphabetically
            persona_items.sort((a, b) => {
                if (a.type === "persona" && b.type === "persona") {
                    return a.persona.name.localeCompare(b.persona.name);
                }
                return 0;
            });

            return [...sorted, ...puppets, ...persona_items] as WhisperTypeaheadItem[];
        },
        updater(item: WhisperTypeaheadItem, _query: string): undefined {
            if (!widget) {
                return undefined;
            }

            if (item.type === "user_group") {
                user_group_pill.append_user_group(item, widget as unknown as CombinedPillContainer);
            } else if (item.type === "puppet") {
                // Add puppet pill directly
                widget.appendValidatedData({
                    type: "puppet",
                    puppet_id: item.puppet.id,
                    puppet_name: item.puppet.name,
                });
            } else if (item.type === "persona") {
                // Add persona pill directly
                widget.appendValidatedData({
                    type: "persona",
                    persona_id: item.persona.id,
                    persona_name: item.persona.name,
                });
            } else {
                assert(item.type === "user");
                user_pill.append_person({
                    pill_widget: widget as unknown as CombinedPillContainer,
                    person: item.user,
                });
            }
            return undefined;
        },
        stopAdvance: true,
    });

    widget.onPillCreate(() => {
        update_compose_state();
        on_pill_create_or_remove();
        $("#whisper_recipient").trigger("focus");
    });

    widget.onPillRemove(() => {
        update_compose_state();
        on_pill_create_or_remove();
    });
}

export function clear(): void {
    if (widget) {
        widget.clear();
    }
    compose_state.set_whisper_recipients([], [], [], []);
}

export function get_user_ids(): number[] {
    if (!widget) {
        return [];
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    return user_pill.get_user_ids(widget as unknown as CombinedPillContainer);
}

export function get_group_ids(): number[] {
    if (!widget) {
        return [];
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    return user_group_pill.get_group_ids(widget as unknown as CombinedPillContainer);
}

export function get_puppet_ids(): number[] {
    if (!widget) {
        return [];
    }
    return widget
        .items()
        .filter((item): item is PuppetPill => item.type === "puppet")
        .map((item) => item.puppet_id);
}

export function get_persona_ids(): number[] {
    if (!widget) {
        return [];
    }
    return widget
        .items()
        .filter((item): item is PersonaPill => item.type === "persona")
        .map((item) => item.persona_id);
}

export function has_recipients(): boolean {
    if (!widget) {
        return false;
    }
    return widget.items().length > 0;
}

export function set_from_user_ids(user_ids: number[]): void {
    if (!widget) {
        return;
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    const combined_widget = widget as unknown as CombinedPillContainer;
    for (const user_id of user_ids) {
        const person = people.maybe_get_user_by_id(user_id);
        if (person) {
            user_pill.append_person({
                pill_widget: combined_widget,
                person,
            });
        }
    }
}

export function set_from_group_ids(group_ids: number[]): void {
    if (!widget) {
        return;
    }
    // Cast to CombinedPillContainer since WhisperPill is a superset of CombinedPill
    const combined_widget = widget as unknown as CombinedPillContainer;
    for (const group_id of group_ids) {
        const group = user_groups.maybe_get_user_group_from_id(group_id);
        if (group) {
            user_group_pill.append_user_group(group, combined_widget);
        }
    }
}

export function set_from_puppet_ids(puppet_ids: number[]): void {
    if (!widget || current_stream_id === undefined) {
        return;
    }
    const puppets = stream_puppets.get_puppets_for_stream(current_stream_id);
    for (const puppet_id of puppet_ids) {
        const puppet = puppets.find((p) => p.id === puppet_id);
        if (puppet) {
            widget.appendValidatedData({
                type: "puppet",
                puppet_id: puppet.id,
                puppet_name: puppet.name,
            });
        }
    }
}

export function set_from_persona_ids(persona_ids: number[]): void {
    if (!widget) {
        return;
    }
    const realm_personas = personas.get_realm_personas();
    for (const persona_id of persona_ids) {
        const persona = realm_personas.find((p) => p.id === persona_id);
        if (persona) {
            widget.appendValidatedData({
                type: "persona",
                persona_id: persona.id,
                persona_name: persona.name,
            });
        }
    }
}

export function set_from_all_ids(
    user_ids: number[],
    group_ids: number[],
    puppet_ids: number[] = [],
    persona_ids: number[] = [],
): void {
    if (!widget) {
        return;
    }
    // Clear existing pills first
    widget.clear();
    // Add users
    set_from_user_ids(user_ids);
    // Add groups
    set_from_group_ids(group_ids);
    // Add puppets
    set_from_puppet_ids(puppet_ids);
    // Add personas
    set_from_persona_ids(persona_ids);
    // Update compose state
    compose_state.set_whisper_recipients(user_ids, group_ids, puppet_ids, persona_ids);
}

// Backward compatibility alias
export function set_from_user_and_group_ids(user_ids: number[], group_ids: number[]): void {
    set_from_all_ids(user_ids, group_ids, [], []);
}
