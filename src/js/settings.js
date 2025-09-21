import { checkAuth, loadComponent } from './utils.js';

const pb = checkAuth();
if (!pb) throw new Error("Redirecting to login...");

const currentUser = pb.authStore.model;

async function initSettingsPage() {
    await loadComponent('main-header', '/src/components/navbar.html');

    // Navbar init
    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `/src/pages/profile.html?u=${currentUser.username}`;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.replace('/src/pages/welcome.html');
    });

    populateProfileForm();
    setupProfileForm();
    setupPasswordForm();
}

function populateProfileForm() {
    document.getElementById('settings-fullname').value = currentUser.full_name || '';
    document.getElementById('settings-bio').value = currentUser.bio || '';
}

function setupProfileForm() {
    const form = document.getElementById('profile-settings-form');
    const feedbackEl = document.getElementById('profile-feedback');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback-message';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const data = {
            full_name: document.getElementById('settings-fullname').value,
            bio: document.getElementById('settings-bio').value,
        };

        try {
            await pb.collection('users').update(currentUser.id, data);
            feedbackEl.textContent = 'Profile updated successfully!';
            feedbackEl.classList.add('success');

            // Refresh the local user model to reflect changes immediately
            await pb.collection('users').authRefresh();
        } catch (err) {
            console.error("Failed to update profile:", err);
            feedbackEl.textContent = 'Error updating profile.';
            feedbackEl.classList.add('error');
        } finally {
            submitBtn.disabled = false;
            // Clear feedback after a few seconds
            setTimeout(() => { feedbackEl.textContent = ''; feedbackEl.className = 'feedback-message'; }, 3000);
        }
    });
}

function setupPasswordForm() {
    const form = document.getElementById('password-settings-form');
    const feedbackEl = document.getElementById('password-feedback');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback-message';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const data = {
            oldPassword: document.getElementById('old-password').value,
            password: document.getElementById('new-password').value,
            passwordConfirm: document.getElementById('new-password-confirm').value,
        };

        if (data.password.length < 8) {
            feedbackEl.textContent = 'New password must be at least 8 characters.';
            feedbackEl.classList.add('error');
            submitBtn.disabled = false;
            return;
        }

        if (data.password !== data.passwordConfirm) {
            feedbackEl.textContent = 'New passwords do not match.';
            feedbackEl.classList.add('error');
            submitBtn.disabled = false;
            return;
        }

        try {
            await pb.collection('users').update(currentUser.id, data);
            feedbackEl.textContent = 'Password changed successfully!';
            feedbackEl.classList.add('success');
            form.reset();
        } catch (err) {
            console.error("Failed to change password:", err);
            feedbackEl.textContent = 'Failed to change password. Check your old password.';
            feedbackEl.classList.add('error');
        } finally {
             submitBtn.disabled = false;
             setTimeout(() => { feedbackEl.textContent = ''; feedbackEl.className = 'feedback-message'; }, 3000);
        }
    });
}

initSettingsPage();
