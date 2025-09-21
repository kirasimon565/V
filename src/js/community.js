import { checkAuth, loadComponent, timeAgo, simpleMarkdown } from './utils.js';

const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");

async function init() {
    await loadComponent('main-header', '/src/components/navbar.html');

    // Simplified navbar init
    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `/src/pages/profile.html?u=${pb.authStore.model.username}`;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.replace('/src/pages/welcome.html');
    });

    if (document.getElementById('communities-list')) {
        loadCommunitiesList();
    } else if (document.getElementById('community-container')) {
        loadSingleCommunity();
    }
}

async function loadCommunitiesList() {
    const listContainer = document.getElementById('communities-list');
    try {
        const communities = await pb.collection('communities').getFullList({
            filter: 'private = false',
            sort: '-created'
        });

        if (communities.length === 0) {
            listContainer.innerHTML = '<p class="loading-message">No public communities found.</p>';
            return;
        }

        listContainer.innerHTML = ''; // Clear loading
        const cardTemplate = await (await fetch('/src/components/community-card.html')).text();

        for (const community of communities) {
            const card = document.createElement('div');
            card.innerHTML = cardTemplate;
            card.querySelector('.community-card-name').textContent = community.name;
            card.querySelector('.community-card-description').textContent = community.description;
            card.querySelector('.view-btn').href = `/src/pages/community.html?id=${community.id}`;
            listContainer.appendChild(card.firstElementChild);
        }

    } catch (err) {
        console.error("Failed to load communities list:", err);
        listContainer.innerHTML = '<p class="loading-message">Could not load communities.</p>';
    }
}

async function loadSingleCommunity() {
    const container = document.getElementById('community-container');
    const urlParams = new URLSearchParams(window.location.search);
    const communityId = urlParams.get('id');

    if (!communityId) {
        container.innerHTML = '<p class="loading-message">No community ID specified.</p>';
        return;
    }

    try {
        const community = await pb.collection('communities').getOne(communityId);
        document.title = `${community.name} - (V)`;

        // Render header
        const headerHtml = `
            <div class="community-header">
                <h1>${community.name}</h1>
                <p>${community.description}</p>
                ${community.rules ? `<div class="community-rules"><h4>Rules</h4>${simpleMarkdown(community.rules)}</div>` : ''}
            </div>
            <div class="community-feed" id="community-feed-posts">
                <p class="loading-message">Loading posts...</p>
            </div>
        `;
        container.innerHTML = headerHtml;

        // Load posts
        const postsContainer = document.getElementById('community-feed-posts');
        const posts = await pb.collection('posts').getFullList({
            filter: `community = "${communityId}"`,
            expand: 'author',
            sort: '-created'
        });

        if (posts.length === 0) {
            postsContainer.innerHTML = '<p class="loading-message">No posts in this community yet.</p>';
            return;
        }

        postsContainer.innerHTML = ''; // Clear loading
        const postCardTemplate = await (await fetch('/src/components/post-card.html')).text();

        for (const post of posts) {
            const card = document.createElement('div');
            card.innerHTML = postCardTemplate;
            const author = post.expand.author;
            card.querySelector('.post-author-name').textContent = author.full_name || 'No Name';
            card.querySelector('.post-author-username').textContent = `@${author.username}`;
            card.querySelector('.post-author-link').href = `/src/pages/profile.html?u=${author.username}`;
            card.querySelector('.post-timestamp').textContent = `· ${timeAgo(post.created)}`;
            card.querySelector('.post-content p').innerHTML = simpleMarkdown(post.content);
            postsContainer.appendChild(card.firstElementChild);
        }

    } catch (err) {
        console.error("Failed to load community:", err);
        container.innerHTML = '<p class="loading-message">Could not load this community. It may be private or does not exist.</p>';
    }
}

init();
