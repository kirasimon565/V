// Note: Using the ES module version of the SDK
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.2/dist/pocketbase.es.mjs';

const pb = new PocketBase('http://127.0.0.1:8090');

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identity = e.target.identity.value;
        const password = e.target.password.value;
        const errorContainer = document.getElementById('error-container');
        const submitButton = loginForm.querySelector('button[type="submit"]');

        // Reset state
        errorContainer.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Logging In...';

        try {
            const authData = await pb.collection('users').authWithPassword(identity, password);
            console.log('Logged in successfully!', authData);
            // Redirect to the main router, which will send user to the home page
            window.location.replace('/src/index.html');
        } catch (err) {
            console.error('Login failed:', err);
            errorContainer.textContent = 'Login failed. Please check your username/email and password.';
            submitButton.disabled = false;
            submitButton.textContent = 'Log In';
        }
    });
}

// --- SIGNUP LOGIC ---
const signupModal = document.querySelector('.signup-modal');
if (signupModal) {
    const steps = document.querySelectorAll('.signup-step');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const finishBtn = document.getElementById('finish-btn');
    const progressBarFill = document.getElementById('progress-bar-fill');

    let currentStep = 1;
    const totalSteps = steps.length;
    const userData = {}; // Object to hold data across steps

    const updateUI = () => {
        // Update progress bar
        progressBarFill.style.width = `calc(100% / ${totalSteps} * ${currentStep})`;

        // Show current step
        steps.forEach(step => {
            step.classList.toggle('active', parseInt(step.dataset.step) === currentStep);
        });

        // Update button visibility
        backBtn.classList.toggle('hidden', currentStep === 1);
        nextBtn.classList.toggle('hidden', currentStep === totalSteps);
        finishBtn.classList.toggle('hidden', currentStep !== totalSteps);
    };

    const validateStep = async (step) => {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        let isValid = true;

        switch (step) {
            case 1: // Username
                const usernameInput = document.getElementById('username');
                const usernameError = document.getElementById('username-error');
                const username = usernameInput.value.trim().toLowerCase();
                if (!/^[a-z0-9_]{3,20}$/.test(username)) {
                    usernameError.textContent = 'Must be 3-20 lowercase letters, numbers, or underscores.';
                    isValid = false;
                } else {
                    try {
                        await pb.collection('users').getFirstListItem(`username="${username}"`);
                        usernameError.textContent = 'Username is already taken.';
                        isValid = false;
                    } catch (error) {
                        if (error.status !== 404) {
                            usernameError.textContent = 'Error checking username.';
                            isValid = false;
                        }
                    }
                }
                if (isValid) userData.username = username;
                break;
            case 2: // Full Name
                const fullNameInput = document.getElementById('full_name');
                if (fullNameInput.value.trim().length < 1 || fullNameInput.value.length > 50) {
                    document.getElementById('fullname-error').textContent = 'Full name is required (max 50 characters).';
                    isValid = false;
                } else {
                    userData.full_name = fullNameInput.value.trim();
                }
                break;
            case 3: // Password
                const passwordInput = document.getElementById('password_signup');
                const passwordConfirmInput = document.getElementById('passwordConfirm');
                const passwordError = document.getElementById('password-error');
                if (passwordInput.value.length < 8) {
                    passwordError.textContent = 'Password must be at least 8 characters long.';
                    isValid = false;
                } else if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(passwordInput.value)) {
                    passwordError.textContent = 'Password must contain at least one letter and one number.';
                    isValid = false;
                } else if (passwordInput.value !== passwordConfirmInput.value) {
                    passwordError.textContent = 'Passwords do not match.';
                    isValid = false;
                } else {
                    userData.password = passwordInput.value;
                    userData.passwordConfirm = passwordConfirmInput.value;
                }
                break;
            case 4: // Email
                const emailInput = document.getElementById('email');
                const emailError = document.getElementById('email-error');
                const email = emailInput.value.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    emailError.textContent = 'Please enter a valid email address.';
                    isValid = false;
                } else {
                     try {
                        await pb.collection('users').getFirstListItem(`email="${email}"`);
                        emailError.textContent = 'This email address is already in use.';
                        isValid = false;
                    } catch (error) {
                        if (error.status !== 404) {
                           emailError.textContent = 'Error checking email address.';
                           isValid = false;
                        }
                    }
                }
                if(isValid) userData.email = email;
                break;
            case 5: // Interests - No validation
                break;
            case 6: // Bio - No validation
                userData.bio = document.getElementById('bio').value.trim();
                break;
        }
        return isValid;
    };

    nextBtn.addEventListener('click', async () => {
        const isValid = await validateStep(currentStep);
        if (isValid && currentStep < totalSteps) {
            currentStep++;
            updateUI();
        }
    });

    backBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateUI();
        }
    });

    finishBtn.addEventListener('click', async () => {
        if (!await validateStep(currentStep)) return;

        finishBtn.disabled = true;
        finishBtn.textContent = 'Creating Account...';

        try {
            // The verified field is handled by PocketBase's email verification flow
            const newUser = await pb.collection('users').create(userData);

            // After creating, authenticate the user to log them in
            await pb.collection('users').authWithPassword(userData.email, userData.password);

            // Optional: Send verification email
            await pb.collection('users').requestVerification(userData.email);

            // Redirect to router
            window.location.replace('/src/index.html');
        } catch (err) {
            console.error('Signup failed:', err);
            document.getElementById('bio-error').textContent = `An unexpected error occurred: ${err.message}`;
            finishBtn.disabled = false;
            finishBtn.textContent = 'Enter (V)';
        }
    });

    // Initial UI setup
    updateUI();
}


// --- LOGOUT LOGIC will be added here ---
