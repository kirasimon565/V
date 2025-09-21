import { checkAuth, loadComponent, createPostCardElement } from './utils.js';

const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");

const currentUser = pb.authStore.model;

async function initSearchPage() {
    await loadComponent('main-header', '/src/components/navbar.html');

    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `/src/pages/profile.html?u=${currentUser.username}`;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.replace('/src/pages/welcome.html');
    });

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    const searchInput = document.getElementById('search-input-page');
    searchInput.value = query || '';

    if (query) {
        document.title = `Search for "${query}" - (V)`;
        runSearch(query);
    } else {
        document.title = 'Search - (V)';
    }

    const searchForm = document.getElementById('search-form-page');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newQuery = searchInput.value.trim();
        if (newQuery) {
            window.location.href = `/src/pages/search.html?q=${encodeURIComponent(newQuery)}`;
        }
    });
}

async function runSearch(query) {
    // Sanitize query for filter
    const sanitizedQuery = query.replace(/"/g, '\\"');

    const usersPromise = pb.collection('users').getList(1, 10, {
        filter: `username ~ "${sanitizedQuery}" || full_name ~ "${sanitizedQuery}"`
    });

    const communitiesPromise = pb.collection('communities').getList(1, 10, {
        filter: `(name ~ "${sanitizedQuery}" || description ~ "${sanitizedQuery}") && private = false`
    });

    const postsPromise = pb.collection('posts').getList(1, 15, {
        filter: `content ~ "${sanitizedQuery}"`,
        expand: 'author,original_post,original_post.author'
    });

    const [usersResult, communitiesResult, postsResult] = await Promise.allSettled([
        usersPromise, communitiesPromise, postsPromise
    ]);

    renderUsers(usersResult.status === 'fulfilled' ? usersResult.value.items : []);
    renderCommunities(communitiesResult.status === 'fulfilled' ? communitiesResult.value.items : []);
    renderPosts(postsResult.status === 'fulfilled' ? postsResult.value.items : []);
}

function renderUsers(users) {
    const container = document.getElementById('users-list');
    if (users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }
    container.innerHTML = '';
    users.forEach(user => {
        const userHtml = `
            <div class="user-list-item">
                <a href="/src/pages/profile.html?u=${user.username}">
                    <div class="user-list-avatar"></div>
                    <div>
                        <strong class="user-list-name">${user.full_name || 'No Name'}</strong>
                        <p class="user-list-username">@${user.username}</p>
                    </div>
                </a>
            </div>
        `;
        container.innerHTML += userHtml;
    });
}

async function renderCommunities(communities) {
    const container = document.getElementById('communities-list');
    if (communities.length === 0) {
        container.innerHTML = '<p>No communities found.</p>';
        return;
    }
    container.innerHTML = '';
    const cardTemplate = await (await fetch('/src/components/community-card.html')).text();
    communities.forEach(community => {
        const card = document.createElement('div');
        card.innerHTML = cardTemplate;
        card.querySelector('.community-card-name').textContent = community.name;
        card.querySelector('.community-card-description').textContent = community.description;
        card.querySelector('.view-btn').href = `/src/pages/community.html?id=${community.id}`;
        container.appendChild(card.firstElementChild);
    });
}

async function renderPosts(posts) {
    const container = document.getElementById('posts-list');
    if (posts.length === 0) {
        container.innerHTML = '<p>No posts found.</p>';
        return;
    }
    container.innerHTML = '';
    for (const post of posts) {
        const postCard = await createPostCardElement(post, pb, currentUser);
        container.appendChild(postCard);
    }
}

initSearchPage();
