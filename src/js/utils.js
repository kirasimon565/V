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


// --- Post Card Rendering ---

let postCardTemplate = null;
async function getPostCardTemplate() {
    if (!postCardTemplate) {
        try {
            const response = await fetch('/src/components/post-card.html');
            if (!response.ok) throw new Error(`Failed to fetch template: ${response.statusText}`);
            postCardTemplate = await response.text();
        } catch (error) {
            console.error(error);
            return '<p>Error loading post template.</p>';
        }
    }
    return postCardTemplate;
}

export async function createPostCardElement(post, pb, currentUser, isEmbed = false) {
    // A post can be a regular post or a repost (which has content + an original_post)
    const isRepost = post.original_post && post.expand?.original_post;

    if (isRepost) {
        // This is a repost. Render a wrapper, the repost comment, and the embedded original post.
        const repostAuthor = post.expand?.author;
        const originalPost = post.expand.original_post;

        const wrapper = document.createElement('div');
        wrapper.className = 'repost-wrapper card';

        const repostInfo = document.createElement('div');
        repostInfo.className = 'repost-info';
        repostInfo.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <a href="/src/pages/profile.html?u=${repostAuthor.username}">@${repostAuthor.username}</a> reposted
        `;
        wrapper.appendChild(repostInfo);

        if (post.content) {
            const repostContent = document.createElement('p');
            repostContent.className = 'repost-content';
            repostContent.innerHTML = simpleMarkdown(post.content);
            wrapper.appendChild(repostContent);
        }

        // Render the original post in an embedded/non-interactive way
        const originalPostCard = await createPostCardElement(originalPost, pb, currentUser, true);
        wrapper.appendChild(originalPostCard);

        return wrapper;

    } else {
        // This is a regular post
        const template = await getPostCardTemplate();
        const card = document.createElement('div');
        card.innerHTML = template;
        const postCard = card.firstElementChild;
        postCard.dataset.postId = post.id;

        const author = post.expand?.author;
        if (author) {
            postCard.querySelector('.post-author-name').textContent = author.full_name || 'No Name';
            postCard.querySelector('.post-author-username').textContent = `@${author.username}`;
            postCard.querySelector('.post-author-link').href = `/src/pages/profile.html?u=${author.username}`;
        }

        postCard.querySelector('.post-timestamp').textContent = `· ${timeAgo(post.created)}`;
        postCard.querySelector('.post-content p').innerHTML = simpleMarkdown(post.content);

        if (!isEmbed) {
            postCard.addEventListener('click', (e) => {
                if (e.target.closest('button, a')) return;
                window.location.href = `/src/pages/post.html?id=${post.id}`;
            });

            // Setup interaction buttons
            await setupLikeButton(postCard.querySelector('.like-btn'), post, pb, currentUser);
            await setupBookmarkButton(postCard.querySelector('.bookmark-btn'), post.id, pb, currentUser);
            await setupRepostButton(postCard.querySelector('.repost-btn'), post, pb, currentUser);
        } else {
            // Remove footer from embedded posts
            postCard.querySelector('.post-footer').remove();
            postCard.style.cursor = 'pointer';
            postCard.addEventListener('click', () => window.location.href = `/src/pages/post.html?id=${post.id}`);
        }

        return postCard;
    }
}

async function setupRepostButton(button, post, pb, currentUser) {
    const modal = document.getElementById('repost-modal-overlay');
    if (!modal) return;

    const form = modal.querySelector('#repost-form');
    const embedContainer = modal.querySelector('#original-post-embed');
    const cancelBtn = modal.querySelector('#cancel-repost-btn');
    const errorContainer = modal.querySelector('#repost-error');

    button.addEventListener('click', async () => {
        // Populate the modal with a non-interactive clone of the post
        const postClone = await createPostCardElement(post, pb, currentUser, true);
        embedContainer.innerHTML = '';
        embedContainer.appendChild(postClone);

        modal.classList.remove('hidden');

        // Use a one-time event listener for submission
        const handleSubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            errorContainer.textContent = '';

            try {
                const data = {
                    author: currentUser.id,
                    content: modal.querySelector('#repost-comment').value,
                    original_post: post.id,
                };
                const newRepost = await pb.collection('posts').create(data, {
                    expand: 'author,original_post,original_post.author'
                });

                modal.classList.add('hidden');
                form.reset();

                // Dispatch a custom event so the feed can update itself
                const event = new CustomEvent('newPostCreated', { detail: newRepost });
                document.dispatchEvent(event);

            } catch (err) {
                console.error("Failed to repost:", err);
                errorContainer.textContent = 'Could not repost at this time.';
            } finally {
                submitBtn.disabled = false;
                form.removeEventListener('submit', handleSubmit);
            }
        };

        form.addEventListener('submit', handleSubmit);

        // Also need a one-time listener for the cancel button
        const handleCancel = () => {
            modal.classList.add('hidden');
            form.reset();
            form.removeEventListener('submit', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        cancelBtn.addEventListener('click', handleCancel);
    });
}

async function setupBookmarkButton(button, postId, pb, currentUser) {
    let userBookmarkRecord = null;
    try {
        userBookmarkRecord = await pb.collection('interactions').getFirstListItem(`post = "${postId}" && user = "${currentUser.id}" && type = "bookmark"`);
        button.classList.add('active');
    } catch (error) {
        if (error.status !== 404) console.error("Error checking for user's bookmark:", error);
    }

    button.addEventListener('click', async () => {
        button.disabled = true;
        if (userBookmarkRecord) {
            // Un-bookmark
            try {
                await pb.collection('interactions').delete(userBookmarkRecord.id);
                userBookmarkRecord = null;
                button.classList.remove('active');
            } catch (err) {
                console.error("Failed to un-bookmark:", err);
            }
        } else {
            // Bookmark
            try {
                const data = { user: currentUser.id, post: postId, type: 'bookmark' };
                userBookmarkRecord = await pb.collection('interactions').create(data);
                button.classList.add('active');
            } catch (err) {
                console.error("Failed to bookmark:", err);
            }
        }
        button.disabled = false;
    });
}

async function setupLikeButton(button, post, pb, currentUser) {
    const likeCountSpan = button.querySelector('.like-count');
    const postId = post.id;

    // 1. Get initial like count for the post
    // This is a simplified approach. A real app might store counts on the post record itself for performance.
    const countResult = await pb.collection('interactions').getList(1, 1, {
        filter: `post = "${postId}" && type = "like"`
    });
    let likeCount = countResult.totalItems;
    likeCountSpan.textContent = likeCount;

    // 2. Check if the current user has liked this post
    let userLikeRecord = null;
    try {
        userLikeRecord = await pb.collection('interactions').getFirstListItem(`post = "${postId}" && user = "${currentUser.id}" && type = "like"`);
        button.classList.add('active');
    } catch (error) {
        if (error.status !== 404) console.error("Error checking for user's like:", error);
    }

    // 3. Add click event listener
    button.addEventListener('click', async () => {
        button.disabled = true;
        if (userLikeRecord) {
            // Unlike
            try {
                await pb.collection('interactions').delete(userLikeRecord.id);
                userLikeRecord = null;
                button.classList.remove('active');
                likeCount--;
                likeCountSpan.textContent = likeCount;
            } catch (err) {
                console.error("Failed to unlike:", err);
            }
        } else {
            // Like
            try {
                const data = { user: currentUser.id, post: postId, type: 'like' };
                userLikeRecord = await pb.collection('interactions').create(data);
                button.classList.add('active');
                likeCount++;
                likeCountSpan.textContent = likeCount;

                // Create Notification
                if (post.author !== currentUser.id) {
                    const notificationData = {
                        user: post.author,
                        source_user: currentUser.id,
                        type: 'like',
                        post: postId,
                        read: false
                    };
                    pb.collection('notifications').create(notificationData).catch(err => {
                        console.error("Failed to create notification:", err);
                    });
                }
            } catch (err) {
                console.error("Failed to like:", err);
            }
        }
        button.disabled = false;
    });
}
