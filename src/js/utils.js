import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.2/dist/pocketbase.es.mjs';

/**
 * Checks if a user is authenticated. If not, redirects to the welcome page.
 * @returns {PocketBase} The PocketBase instance.
 */
export function checkAuth() {
    const pb = new PocketBase('http://127.0.0.1:8090');
    if (!pb.authStore.isValid) {
        window.location.replace('/src/pages/welcome.html');
        return null;
    }
    return pb;
}

/**
 * Loads an HTML component from a file into a specified element.
 * @param {string} elementId - The ID of the element to load the component into.
 * @param {string} url - The URL of the HTML component file.
 */
export async function loadComponent(elementId, url) {
    const element = document.getElementById(elementId);
    if (element) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                element.innerHTML = await response.text();
            } else {
                element.innerHTML = `<p>Error loading component: ${response.statusText}</p>`;
                console.error(`Failed to load component ${url}: ${response.statusText}`);
            }
        } catch (error) {
             element.innerHTML = `<p>Error loading component: ${error.message}</p>`;
             console.error(`Failed to load component ${url}: ${error.message}`);
        }
    }
}

/**
 * Converts a date string into a "time ago" format.
 * @param {string} dateString - The ISO date string to convert.
 * @returns {string} The formatted time ago string (e.g., "5m", "1h", "3d").
 */
export function timeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000; // years
    if (interval > 1) return Math.floor(interval) + "y";

    interval = seconds / 2592000; // months
    if (interval > 1) return Math.floor(interval) + "mo";

    interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + "d";

    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + "h";

    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + "m";

    return Math.floor(seconds) + "s";
}

/**
 * A simple markdown-to-HTML converter.
 * Supports **bold** and *italic*.
 * @param {string} text - The text to convert.
 * @returns {string} The HTML-formatted string.
 */
export function simpleMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>');       // Italic
}
