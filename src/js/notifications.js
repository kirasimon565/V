import { checkAuth, loadComponent, timeAgo } from './utils.js';

const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");

const iconMap = {
    like: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="like-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    comment: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="comment-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    follow: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>`,
};

async function initNotificationsPage() {
    await loadComponent('main-header', '/src/components/navbar.html');

    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `/src/pages/profile.html?u=${pb.authStore.model.username}`;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.replace('/src/pages/welcome.html');
    });

    loadNotifications();
}

async function loadNotifications() {
    const listContainer = document.getElementById('notifications-list');
    try {
        const notifications = await pb.collection('notifications').getFullList({
            filter: `user = "${pb.authStore.model.id}"`,
            sort: '-created',
            expand: 'source_user,post'
        });

        if (notifications.length === 0) {
            listContainer.innerHTML = '<p class="loading-message">You have no notifications.</p>';
            return;
        }

        listContainer.innerHTML = '';
        const template = await (await fetch('/src/components/notification-card.html')).text();

        for (const notif of notifications) {
            const card = document.createElement('div');
            card.innerHTML = template;
            const notificationCard = card.firstElementChild;

            if (!notif.read) {
                notificationCard.classList.add('unread');
            }

            const iconContainer = notificationCard.querySelector('.notification-icon');
            const contentP = notificationCard.querySelector('.notification-content p');
            const sourceUser = notif.expand.source_user;
            let message = 'You have a new notification.';

            if (iconMap[notif.type]) {
                iconContainer.innerHTML = iconMap[notif.type];
            }

            if (sourceUser) {
                switch (notif.type) {
                    case 'like':
                        message = `<strong>@${sourceUser.username}</strong> liked your post.`;
                        break;
                    case 'comment':
                        message = `<strong>@${sourceUser.username}</strong> commented on your post.`;
                        break;
                    case 'follow':
                        message = `<strong>@${sourceUser.username}</strong> started following you.`;
                        break;
                }
            }
            contentP.innerHTML = message;
            notificationCard.querySelector('.notification-timestamp').textContent = timeAgo(notif.created);

            notificationCard.addEventListener('click', async () => {
                if (!notif.read) {
                    try {
                        await pb.collection('notifications').update(notif.id, { read: true });
                        notificationCard.classList.remove('unread');
                    } catch (err) {
                        console.error("Failed to mark notification as read:", err);
                    }
                }
                // For now, clicking a notification does not redirect anywhere to keep it simple.
                // A full implementation would redirect to the specific post or user profile.
            });

            listContainer.appendChild(notificationCard);
        }

    } catch (err) {
        console.error("Failed to load notifications:", err);
        listContainer.innerHTML = '<p class="loading-message">Could not load notifications.</p>';
    }
}

initNotificationsPage();
