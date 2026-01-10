/**
 * Personas store - user's character identities
 */

import {writable, derived} from "svelte/store";

export interface Persona {
    id: number;
    name: string;
    avatar_url: string | null;
    color: string | null;
    bio: string;
    is_active: boolean;
    date_created: number;
}

function createPersonasStore() {
    const {subscribe, set, update} = writable<Persona[]>([]);

    return {
        subscribe,
        set,
        addPersona(persona: Persona) {
            update((personas) => [...personas, persona]);
        },
        updatePersona(id: number, updates: Partial<Persona>) {
            update((personas) => personas.map((p) => (p.id === id ? {...p, ...updates} : p)));
        },
        removePersona(id: number) {
            update((personas) => personas.filter((p) => p.id !== id));
        },
        clear() {
            set([]);
        },
    };
}

export const personas = createPersonasStore();

/**
 * Currently active persona ID (null = posting as self)
 */
export const activePersonaId = writable<number | null>(null);

/**
 * Derived: full persona object for active persona
 */
export const activePersona = derived(
    [personas, activePersonaId],
    ([$personas, $activePersonaId]) =>
        $activePersonaId ? $personas.find((p) => p.id === $activePersonaId) ?? null : null,
);

/**
 * Derived: only active personas (not soft-deleted)
 */
export const activePersonas = derived(personas, ($personas) =>
    $personas.filter((p) => p.is_active),
);
