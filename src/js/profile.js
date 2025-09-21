import { checkAuth, loadComponent, timeAgo, simpleMarkdown } from './utils.js';

// --- Auth Check and Basic Setup ---
const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");
const currentUser = pb.authStore.model;

// --- Main Initialization ---
async function initProfilePage() {
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
    // Follow logic is a placeholder for now
    return `<button class="btn btn-primary" id="follow-btn">Follow</button>`;
}

function setupTabs(user) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tab = button.dataset.tab;
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === `${tab}-content`);
            });

            // Load content on tab click if it hasn't been loaded
            if (tab === 'posts' && button.dataset.loaded !== 'true') {
                loadUserPosts(user.id);
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
            expand: 'author'
        });

        if (resultList.items.length === 0) {
            postsContainer.innerHTML = '<p class="loading-message">This user hasn\'t posted anything yet.</p>';
            return;
        }

        postsContainer.innerHTML = ''; // Clear loading message
        const postCardTemplate = await (await fetch('/src/components/post-card.html')).text();

        for (const post of resultList.items) {
            const card = document.createElement('div');
            card.innerHTML = postCardTemplate;
            const postCard = card.firstElementChild;

            const author = post.expand.author;
            postCard.querySelector('.post-author-name').textContent = author.full_name || 'No Name';
            postCard.querySelector('.post-author-username').textContent = `@${author.username}`;
            postCard.querySelector('.post-author-link').href = `/src/pages/profile.html?u=${author.username}`;
            postCard.querySelector('.post-timestamp').textContent = `· ${timeAgo(post.created)}`;
            postCard.querySelector('.post-content p').innerHTML = simpleMarkdown(post.content);

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

// --- Run Initialization ---
initProfilePage();
