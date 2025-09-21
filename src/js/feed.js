import { checkAuth, loadComponent, timeAgo, simpleMarkdown } from './utils.js';

const pb = checkAuth();
if (!pb) {
    // If checkAuth fails, it will redirect. Stop script execution.
    throw new Error("Redirecting to login...");
}

const currentUser = pb.authStore.model;

async function initHomePage() {
    // Load Navbar and add its logic
    await loadComponent('main-header', '/src/components/navbar.html');
    initNavbar();

    // Setup post creation modal
    initPostModal();

    // Load the main feed
    loadPosts();
}

function initNavbar() {
    const profileLink = document.getElementById('profile-link');
    if (profileLink) {
        profileLink.href = `/src/pages/profile.html?u=${currentUser.username}`;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            pb.authStore.clear();
            window.location.replace('/src/pages/welcome.html');
        });
    }
}

function initPostModal() {
    const newPostBtn = document.getElementById('new-post-btn');
    const modalOverlay = document.getElementById('post-modal-overlay');
    const cancelBtn = document.getElementById('cancel-post-btn');
    const postForm = document.getElementById('create-post-form');
    const contentTextarea = document.getElementById('post-content');
    const charCount = document.getElementById('char-count');
    const postError = document.getElementById('post-error');
    const communitySelect = document.getElementById('post-community');

    newPostBtn.addEventListener('click', async () => {
        modalOverlay.classList.remove('hidden');

        // Fetch user's communities and populate dropdown
        try {
            const records = await pb.collection('communities').getFullList({
                filter: `members ~ "${currentUser.id}"`
            });
            communitySelect.innerHTML = '<option value="">My Profile</option>'; // Reset
            records.forEach(community => {
                const option = document.createElement('option');
                option.value = community.id;
                option.textContent = community.name;
                communitySelect.appendChild(option);
            });
        } catch (err) {
            console.error("Failed to load user's communities", err);
            communitySelect.innerHTML = '<option value="">My Profile</option><option disabled>Could not load communities</option>';
        }
    });

    cancelBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    });

    contentTextarea.addEventListener('input', () => {
        charCount.textContent = contentTextarea.value.length;
    });

    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        postError.textContent = '';
        const submitBtn = postForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const data = {
                "author": currentUser.id,
                "content": contentTextarea.value,
            };
            const selectedCommunity = communitySelect.value;
            if (selectedCommunity) {
                data.community = selectedCommunity;
            }
            const newPost = await pb.collection('posts').create(data, { expand: 'author' });

            modalOverlay.classList.add('hidden');
            postForm.reset();
            charCount.textContent = '0';

            prependPost(newPost);

        } catch (err) {
            console.error('Failed to create post:', err);
            postError.textContent = 'Failed to create post. Please try again.';
        } finally {
            submitBtn.disabled = false;
        }
    });
}

async function loadPosts() {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = '<p class="loading-message">Loading feed...</p>';

    try {
        const resultList = await pb.collection('posts').getList(1, 30, {
            sort: '-created',
            expand: 'author'
        });

        feedContainer.innerHTML = ''; // Clear loading message
        if (resultList.items.length === 0) {
            feedContainer.innerHTML = '<p class="loading-message">The feed is empty. Be the first to post!</p>';
            return;
        }

        for (const post of resultList.items) {
            await appendPost(post);
        }

    } catch (err) {
        console.error('Failed to load posts:', err);
        feedContainer.innerHTML = '<p class="loading-message">Could not load the feed. Please try again later.</p>';
    }
}

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

async function createPostCard(post) {
    const template = await getPostCardTemplate();
    const card = document.createElement('div');
    card.innerHTML = template;
    const postCard = card.firstElementChild;

    postCard.dataset.postId = post.id;

    const author = post.expand.author;
    if (author) {
        postCard.querySelector('.post-author-name').textContent = author.full_name || 'No Name';
        postCard.querySelector('.post-author-username').textContent = `@${author.username}`;
        postCard.querySelector('.post-author-link').href = `/src/pages/profile.html?u=${author.username}`;
    }

    postCard.querySelector('.post-timestamp').textContent = `· ${timeAgo(post.created)}`;
    postCard.querySelector('.post-content p').innerHTML = simpleMarkdown(post.content);

    const likeBtn = postCard.querySelector('.like-btn');
    setupLikeButton(likeBtn, post.id);

    return postCard;
}

async function appendPost(post) {
    const feedContainer = document.getElementById('feed-container');
    const postCard = await createPostCard(post);
    feedContainer.appendChild(postCard);
}

async function prependPost(post) {
    const feedContainer = document.getElementById('feed-container');
    const postCard = await createPostCard(post);
    feedContainer.prepend(postCard);
}

async function setupLikeButton(button, postId) {
    const likeCountSpan = button.querySelector('.like-count');

    // 1. Get initial like count for the post
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
        // 404 means user hasn't liked it, which is fine.
        if (error.status !== 404) console.error("Error checking for user's like:", error);
    }

    // 3. Add click event listener
    button.addEventListener('click', async () => {
        button.disabled = true;
        if (userLikeRecord) {
            // User has liked it, so unlike it
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
            // User hasn't liked it, so like it
            try {
                const data = { user: currentUser.id, post: postId, type: 'like' };
                userLikeRecord = await pb.collection('interactions').create(data);
                button.classList.add('active');
                likeCount++;
                likeCountSpan.textContent = likeCount;

                // --- Create Notification (Client-side simulation) ---
                const post = await pb.collection('posts').getOne(postId);
                if (post.author !== currentUser.id) { // Don't notify on your own posts
                    const notificationData = {
                        user: post.author, // The recipient
                        source_user: currentUser.id,
                        type: 'like',
                        post: postId,
                        read: false
                    };
                    // Fire-and-forget
                    pb.collection('notifications').create(notificationData).catch(err => {
                        console.error("Failed to create notification:", err);
                    });
                }
                // --- End Notification ---

            } catch (err) {
                console.error("Failed to like:", err);
            }
        }
        button.disabled = false;
    });
}


// --- Initialize the Page ---
initHomePage();
