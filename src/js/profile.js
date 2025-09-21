import { checkAuth, loadComponent, timeAgo, simpleMarkdown, createPostCardElement } from './utils.js';

// --- Auth Check and Basic Setup ---
const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");
let currentUser = pb.authStore.model;

// --- Main Initialization ---
async function initProfilePage() {
    // Refresh the authStore to make sure we have the latest user data (e.g. 'following' list)
    await pb.collection('users').authRefresh();
    currentUser = pb.authStore.model;

    await loadComponent('main-header', '/src/components/navbar.html');
    initNavbar(); // Re-initialize navbar logic for this page

    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('u');

    if (!username) {
        renderError("No user specified.");
        return;
    }

    renderProfile(username);
}

// --- Navbar Initialization ---
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

// --- Profile Rendering ---
async function renderProfile(username) {
    try {
        const user = await pb.collection('users').getFirstListItem(`username="${username}"`);
        const container = document.getElementById('profile-main-container');

        const joinDate = new Date(user.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const actionButton = getActionButton(user);
        const verifiedBadge = user.username.toLowerCase() === 'v' ? `<span class="verified-badge" title="Verified Account"></span>` : '';

        const profileHtml = `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-info">
                        <div class="profile-avatar"></div>
                        <div class="profile-details">
                            <div class="profile-name-line">
                                <h1 class="profile-name">${user.full_name || 'No Name'}</h1>
                                ${verifiedBadge}
                            </div>
                            <p class="profile-username">@${user.username}</p>
                            <p class="profile-bio">${user.bio ? simpleMarkdown(user.bio) : ''}</p>
                            <p class="profile-joined-date">Member since ${joinDate}</p>
                        </div>
                        <div class="profile-actions">${actionButton}</div>
                    </div>
                </div>
                <div class="profile-tabs">
                    <button class="tab-btn active" data-tab="posts">Posts</button>
                    <button class="tab-btn" data-tab="communities">Communities</button>
                    <button class="tab-btn" data-tab="bookmarks">Bookmarks</button>
                </div>
                <div id="tab-content-container">
                    <div class="tab-content active" id="posts-content"><p class="loading-message">Loading posts...</p></div>
                    <div class="tab-content" id="communities-content"><p class="loading-message">Feature coming soon.</p></div>
                    <div class="tab-content" id="bookmarks-content"><p class="loading-message">This is private.</p></div>
                </div>
            </div>`;

        container.innerHTML = profileHtml;

        setupTabs(user);
        setupFollowButton(user);
        loadUserPosts(user.id);

    } catch (err) {
        if (err.status === 404) {
            renderError(`User @${username} not found.`);
        } else {
            renderError("Error loading profile.");
            console.error('Failed to load profile:', err);
        }
    }
}

function getActionButton(user) {
    if (user.id === currentUser.id) {
        return `<a href="/src/pages/settings.html" class="btn btn-secondary">Edit Profile</a>`;
    }

    const isFollowing = currentUser.following?.includes(user.id);
    const buttonText = isFollowing ? 'Unfollow' : 'Follow';
    const buttonClass = isFollowing ? 'btn-secondary' : 'btn-primary';

    return `<button class="${buttonClass}" id="follow-btn" data-user-id="${user.id}">${buttonText}</button>`;
}

function setupFollowButton(user) {
    const followBtn = document.getElementById('follow-btn');
    if (!followBtn) return;

    followBtn.addEventListener('click', async () => {
        followBtn.disabled = true;
        const userIdToFollow = user.id;
        const currentFollowing = currentUser.following || [];
        const isCurrentlyFollowing = currentFollowing.includes(userIdToFollow);

        let newFollowing;
        if (isCurrentlyFollowing) {
            // Unfollow
            newFollowing = currentFollowing.filter(id => id !== userIdToFollow);
        } else {
            // Follow
            newFollowing = [...currentFollowing, userIdToFollow];
        }

        try {
            await pb.collection('users').update(currentUser.id, { 'following': newFollowing });
            // Refresh the local user model
            await pb.collection('users').authRefresh();
            currentUser = pb.authStore.model; // Update the global currentUser object

            // Toggle button state visually
            followBtn.textContent = isCurrentlyFollowing ? 'Follow' : 'Unfollow';
            followBtn.classList.toggle('btn-primary');
            followBtn.classList.toggle('btn-secondary');

        } catch (err) {
            console.error("Failed to update follow status", err);
            alert("Could not update follow status.");
        } finally {
            followBtn.disabled = false;
        }
    });
}

function setupTabs(user) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const bookmarksTab = document.querySelector('.tab-btn[data-tab="bookmarks"]');

    // Hide bookmarks tab if not viewing your own profile, as they are private
    if (user.id !== currentUser.id) {
        if (bookmarksTab) bookmarksTab.style.display = 'none';
        document.getElementById('bookmarks-content').style.display = 'none';
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tab = button.dataset.tab;
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === `${tab}-content`);
            });

            // Load content on tab click if it hasn't been loaded
            if (button.dataset.loaded !== 'true') {
                if (tab === 'posts') {
                    loadUserPosts(user.id);
                } else if (tab === 'bookmarks' && user.id === currentUser.id) {
                    loadBookmarkedPosts(user.id);
                }
                button.dataset.loaded = 'true';
            }
        });
    });
}

async function loadUserPosts(userId) {
    const postsContainer = document.getElementById('posts-content');
    postsContainer.innerHTML = '<p class="loading-message">Loading posts...</p>';

    try {
        const resultList = await pb.collection('posts').getList(1, 50, {
            filter: `author = "${userId}"`,
            sort: '-created',
            expand: 'author,original_post,original_post.author'
        });

        if (resultList.items.length === 0) {
            postsContainer.innerHTML = '<p class="loading-message">This user hasn\'t posted anything yet.</p>';
            return;
        }

        postsContainer.innerHTML = ''; // Clear loading message

        for (const post of resultList.items) {
            const postCard = await createPostCardElement(post, pb, currentUser);
            postsContainer.appendChild(postCard);
        }

    } catch (err) {
        console.error('Failed to load user posts:', err);
        renderError("Could not load posts.", postsContainer);
    }
}

function renderError(message, container = document.getElementById('profile-main-container')) {
    if (container) {
        container.innerHTML = `<p class="loading-message">${message}</p>`;
    }
}

async function loadBookmarkedPosts(userId) {
    const container = document.getElementById('bookmarks-content');
    container.innerHTML = '<p class="loading-message">Loading bookmarks...</p>';

    try {
        const resultList = await pb.collection('interactions').getFullList({
            filter: `user = "${userId}" && type = "bookmark"`,
            sort: '-created',
            expand: 'post,post.author'
        });

        if (resultList.length === 0) {
            container.innerHTML = '<p class="loading-message">You haven\'t bookmarked any posts yet.</p>';
            return;
        }

        container.innerHTML = '';
        for (const interaction of resultList) {
            // The post object is nested inside the expand object
            const post = interaction.expand?.post;
            if (post) {
                // We need to ensure the author is also expanded for the post card
                if (!post.expand) post.expand = {};
                post.expand.author = interaction.expand?.['post.author'];

                const postCard = await createPostCardElement(post, pb, currentUser);
                container.appendChild(postCard);
            }
        }

    } catch (err) {
        console.error('Failed to load bookmarks:', err);
        container.innerHTML = '<p class="loading-message">Could not load bookmarks.</p>';
    }
}

// --- Run Initialization ---
initProfilePage();
