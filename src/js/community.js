import { checkAuth, loadComponent, timeAgo, simpleMarkdown, createPostCardElement } from './utils.js';

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

        const isMember = community.members?.includes(currentUser.id);

        const joinButtonHtml = `
            <div class="community-actions">
                <button class="btn ${isMember ? 'btn-secondary' : 'btn-primary'}" id="join-leave-btn">
                    ${isMember ? 'Leave' : 'Join'}
                </button>
            </div>`;

        // Render header
        const headerHtml = `
            <div class="community-header">
                <div class="community-header-main">
                    <div>
                        <h1>${community.name}</h1>
                        <p>${community.description}</p>
                    </div>
                    ${joinButtonHtml}
                </div>
                ${community.rules ? `<div class="community-rules"><h4>Rules</h4>${simpleMarkdown(community.rules)}</div>` : ''}
            </div>
            <div class="community-feed" id="community-feed-posts">
                <p class="loading-message">Loading posts...</p>
            </div>
        `;
        container.innerHTML = headerHtml;

        setupJoinLeaveButton(community);

        // Load posts
        const postsContainer = document.getElementById('community-feed-posts');
        const posts = await pb.collection('posts').getFullList({
            filter: `community = "${communityId}"`,
            expand: 'author,original_post,original_post.author',
            sort: '-created'
        });

        if (posts.length === 0) {
            postsContainer.innerHTML = '<p class="loading-message">No posts in this community yet.</p>';
            return;
        }

        postsContainer.innerHTML = ''; // Clear loading

        for (const post of posts) {
            const postCard = await createPostCardElement(post, pb, currentUser);
            postsContainer.appendChild(postCard);
        }

    } catch (err) {
        console.error("Failed to load community:", err);
        container.innerHTML = '<p class="loading-message">Could not load this community. It may be private or does not exist.</p>';
    }
}

function setupJoinLeaveButton(community) {
    const joinBtn = document.getElementById('join-leave-btn');
    if (!joinBtn) return;
    const currentUser = pb.authStore.model;

    joinBtn.addEventListener('click', async () => {
        joinBtn.disabled = true;
        const currentMembers = community.members || [];
        const isCurrentlyMember = currentMembers.includes(currentUser.id);

        let newMembers;
        if (isCurrentlyMember) {
            newMembers = currentMembers.filter(id => id !== currentUser.id);
        } else {
            newMembers = [...currentMembers, currentUser.id];
        }

        try {
            const updatedCommunity = await pb.collection('communities').update(community.id, { 'members': newMembers });

            // Update local community object and button state
            community.members = updatedCommunity.members;
            joinBtn.textContent = isCurrentlyMember ? 'Join' : 'Leave';
            joinBtn.classList.toggle('btn-primary');
            joinBtn.classList.toggle('btn-secondary');

        } catch (err) {
            console.error("Failed to update membership", err);
            alert("Could not update membership status.");
        } finally {
            joinBtn.disabled = false;
        }
    });
}

init();
