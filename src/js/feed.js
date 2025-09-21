import { checkAuth, loadComponent, createPostCardElement } from './utils.js';

const pb = checkAuth();
if (!pb) {
    // If checkAuth fails, it will redirect. Stop script execution.
    throw new Error("Redirecting to login...");
}

let currentUser = pb.authStore.model;

async function initHomePage() {
    // Get the latest user data to ensure 'following' is up-to-date
    try {
        await pb.collection('users').authRefresh();
        currentUser = pb.authStore.model;
    } catch (err) {
        console.error("Auth refresh failed, feed may be incomplete.", err);
    }

    // Load Navbar and add its logic
    await loadComponent('main-header', '/src/components/navbar.html');
    initNavbar();

    // Setup post creation modal
    initPostModal();

    // Load the main feed
    loadPosts();

    // Listen for new posts created elsewhere (e.g. reposts) to update the feed
    document.addEventListener('newPostCreated', (e) => {
        console.log('New post created event received:', e.detail);
        prependPost(e.detail);
    });
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
    feedContainer.innerHTML = '<p class="loading-message">Loading your personalized feed...</p>';

    try {
        // Step 1: Get IDs of followed users and joined communities
        const followedUsers = currentUser.following || [];
        const joinedCommunitiesResult = await pb.collection('communities').getFullList({
            filter: `members ~ "${currentUser.id}"`
        });
        const joinedCommunityIds = joinedCommunitiesResult.map(c => c.id);

        // Step 2: Build the filter
        const followingFilter = followedUsers.map(id => `author.id = "${id}"`).join(' || ');
        const communitiesFilter = joinedCommunityIds.map(id => `community.id = "${id}"`).join(' || ');

        let finalFilter = '';
        if (followingFilter && communitiesFilter) {
            finalFilter = `(${followingFilter}) || (${communitiesFilter})`;
        } else if (followingFilter) {
            finalFilter = followingFilter;
        } else if (communitiesFilter) {
            finalFilter = communitiesFilter;
        } else {
            // User follows no one and is in no communities
            feedContainer.innerHTML = '<p class="loading-message">Follow users or join communities to see posts here!</p>';
            return;
        }

        // Step 3: Fetch posts with the combined filter
        const resultList = await pb.collection('posts').getList(1, 50, { // Increased limit for combined feed
            filter: finalFilter,
            sort: '-created',
            expand: 'author,original_post,original_post.author'
        });

        feedContainer.innerHTML = ''; // Clear loading message
        if (resultList.items.length === 0) {
            feedContainer.innerHTML = '<p class="loading-message">No posts from your followed users or communities yet.</p>';
            return;
        }

        for (const post of resultList.items) {
            const postCard = await createPostCardElement(post, pb, currentUser);
            feedContainer.appendChild(postCard);
        }

    } catch (err) {
        console.error('Failed to load posts:', err);
        feedContainer.innerHTML = '<p class="loading-message">Could not load your feed. Please try again later.</p>';
    }
}

async function prependPost(post) {
    const feedContainer = document.getElementById('feed-container');
    const postCard = await createPostCardElement(post, pb, currentUser);
    feedContainer.prepend(postCard);
}


// --- Initialize the Page ---
initHomePage();
