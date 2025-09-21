import { checkAuth, loadComponent, createPostCardElement } from './utils.js';

const pb = checkAuth();
if (!pb) throw new Error("Redirecting...");

const currentUser = pb.authStore.model;

async function initPostPage() {
    await loadComponent('main-header', '/src/components/navbar.html');

    // Navbar init
    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `/src/pages/profile.html?u=${currentUser.username}`;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.replace('/src/pages/welcome.html');
    });

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        renderError('No post ID specified.');
        return;
    }

    loadPost(postId);
    setupCommentForm(postId);
    loadComments(postId);
}

async function loadPost(postId) {
    const container = document.getElementById('post-container');
    try {
        const post = await pb.collection('posts').getOne(postId, {
            expand: 'author,original_post,original_post.author'
        });

        document.title = `Post by @${post.expand.author.username} - (V)`;
        container.innerHTML = ''; // Clear loading message

        const postCard = await createPostCardElement(post, pb, currentUser);

        // The single post view shouldn't navigate to itself
        postCard.style.cursor = 'default';
        postCard.addEventListener('click', (e) => e.stopPropagation(), true);

        container.appendChild(postCard);

    } catch (err) {
        console.error("Failed to load post:", err);
        if (err.status === 404) {
            renderError('This post could not be found. It may have been deleted.');
        } else {
            renderError('An error occurred while loading this post.');
        }
    }
}

function renderError(message) {
    const container = document.getElementById('post-container');
    if (container) {
        container.innerHTML = `<p class="loading-message">${message}</p>`;
    }
}

function setupCommentForm(postId) {
    const form = document.getElementById('comment-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textarea = document.getElementById('comment-content');
        const content = textarea.value.trim();
        if (!content) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const data = {
                user: currentUser.id,
                post: postId,
                content: content,
            };
            const newComment = await pb.collection('comments').create(data, { expand: 'user' });

            // Prepend the new comment
            const commentsList = document.getElementById('comments-list');
            const commentCard = await createCommentCard(newComment);
            commentsList.prepend(commentCard);

            form.reset();
        } catch (err) {
            console.error("Failed to post comment:", err);
            alert("Failed to post comment. Please try again.");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

async function loadComments(postId) {
    const listContainer = document.getElementById('comments-list');
    listContainer.innerHTML = `<p class="loading-message">Loading comments...</p>`;
    try {
        const allComments = await pb.collection('comments').getFullList({
            filter: `post = "${postId}"`,
            expand: 'user',
            sort: 'created'
        });

        if (allComments.length === 0) {
            listContainer.innerHTML = ''; // No comments, just leave it empty
            return;
        }

        // Create a map for easy lookup of children
        const commentsByParent = allComments.reduce((acc, comment) => {
            const parentId = comment.parent_comment || 'root';
            if (!acc[parentId]) {
                acc[parentId] = [];
            }
            acc[parentId].push(comment);
            return acc;
        }, {});

        listContainer.innerHTML = '';
        const topLevelComments = commentsByParent['root'] || [];

        for (const comment of topLevelComments) {
            const commentCard = await createCommentCard(comment, commentsByParent);
            listContainer.appendChild(commentCard);
        }

    } catch (err) {
        console.error("Failed to load comments:", err);
        listContainer.innerHTML = `<p class="loading-message">Could not load comments.</p>`;
    }
}

async function createCommentCard(comment, commentsByParent = {}, level = 0) {
    const template = await (await fetch('/src/components/comment-card.html')).text();
    const card = document.createElement('div');
    card.innerHTML = template;
    const commentCard = card.firstElementChild;
    commentCard.dataset.commentId = comment.id;

    const author = comment.expand.user;
    commentCard.querySelector('.comment-author-name').textContent = author.full_name || 'No Name';
    commentCard.querySelector('.comment-author-username').textContent = `@${author.username}`;
    commentCard.querySelector('.comment-author-link').href = `/src/pages/profile.html?u=${author.username}`;
    commentCard.querySelector('.comment-timestamp').textContent = `· ${timeAgo(comment.created)}`;
    commentCard.querySelector('.comment-content p').innerHTML = simpleMarkdown(comment.content);

    // Handle nested replies
    if (level < 2 && commentsByParent[comment.id]) { // Max 3 levels (0, 1, 2)
        const repliesContainer = commentCard.querySelector('.comment-replies');
        for (const reply of commentsByParent[comment.id]) {
            const replyCard = await createCommentCard(reply, commentsByParent, level + 1);
            repliesContainer.appendChild(replyCard);
        }
    }

    // Setup reply button logic
    const replyBtn = commentCard.querySelector('.reply-btn');
    replyBtn.addEventListener('click', () => {
        toggleReplyForm(commentCard, comment);
    });

    return commentCard;
}

function toggleReplyForm(parentCommentCard, parentComment) {
    const replyFormContainer = parentCommentCard.querySelector('.reply-form-container');
    const authorUsername = parentComment.expand.user.username;

    if (replyFormContainer.innerHTML) {
        // If form is already open, close it
        replyFormContainer.innerHTML = '';
        return;
    }

    // Create and inject the form
    const formHtml = `
        <form class="reply-form">
            <div class="form-group">
                <textarea class="form-control" rows="2" placeholder="Replying to @${authorUsername}..." required></textarea>
            </div>
            <div class="modal-actions" style="justify-content: flex-end;">
                <button type="button" class="btn btn-secondary btn-sm cancel-reply-btn">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">Reply</button>
            </div>
        </form>
    `;
    replyFormContainer.innerHTML = formHtml;

    const form = replyFormContainer.querySelector('.reply-form');
    const cancelBtn = form.querySelector('.cancel-reply-btn');
    const textarea = form.querySelector('textarea');
    textarea.focus();

    cancelBtn.addEventListener('click', () => {
        replyFormContainer.innerHTML = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = textarea.value.trim();
        if (!content) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const data = {
                user: currentUser.id,
                post: parentComment.post,
                content: content,
                parent_comment: parentComment.id,
            };
            const newReply = await pb.collection('comments').create(data, { expand: 'user' });

            // Add the new reply to the UI
            const repliesContainer = parentCommentCard.querySelector('.comment-replies');
            const replyCard = await createCommentCard(newReply, {}, (parentComment.level || 0) + 1);
            repliesContainer.appendChild(replyCard);

            // Remove the form
            replyFormContainer.innerHTML = '';
        } catch (err) {
            console.error("Failed to post reply:", err);
            alert("Failed to post reply.");
            submitBtn.disabled = false;
        }
    });
}

initPostPage();
