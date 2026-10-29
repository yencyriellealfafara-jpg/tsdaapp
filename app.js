const SUPABASE_URL = 'https://zlilrvqbkshefyhvauml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsaWxydnFia3NoZWZ5aHZhdW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMjkzNTcsImV4cCI6MjEwODcwNTM1N30.Yrgfoh9c-rjeqRlzOdcEkSLKFYSRtWEtPBMxzOje2dU';

let client = null;

function initSupabase() {
  if (!client && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

window.switchTab = function(tab) {
  const errorMsg = document.getElementById('error-msg');
  if (errorMsg) errorMsg.innerText = "";

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tab === 'login') {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
    if (formLogin) formLogin.style.display = 'block';
    if (formRegister) formRegister.style.display = 'none';
  } else {
    if (tabRegister) tabRegister.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (formRegister) formRegister.style.display = 'block';
    if (formLogin) formLogin.style.display = 'none';
  }
};

window.handleLogin = async function() {
  const loginBtn = document.getElementById('loginBtn');
  const userInput = document.getElementById('loginUsername');
  const codeInput = document.getElementById('loginCode');
  const errorMsg = document.getElementById('error-msg');
  if (errorMsg) errorMsg.innerText = "";

  const username = userInput ? userInput.value.trim() : "";
  const code = codeInput ? codeInput.value.trim() : "";

  if (!username || !code) {
    if (errorMsg) errorMsg.innerText = "Please enter both your username and invite code.";
    return;
  }

  const db = initSupabase();
  if (!db) {
    if (errorMsg) errorMsg.innerText = "Database client failed to load. Please refresh.";
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerText = "Checking...";
  }

  try {
    const isOwner = (username.toLowerCase() === 'francis' && code === 'Fr@nc1s');

    const { data, error } = await db
      .from('users')
      .select('*')
      .ilike('username', username)
      .eq('invite_code', code);

    if (error) {
      if (errorMsg) errorMsg.innerText = "Database error: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      if (errorMsg) errorMsg.innerText = "Invalid username or invite code combination.";
      return;
    }

    const userRecord = data[0];

    if (!userRecord.is_active && !isOwner) {
      if (errorMsg) errorMsg.innerText = "This account has been deactivated.";
      return;
    }

    localStorage.setItem('tsda_user_session', JSON.stringify(userRecord));
    unlockUI(userRecord);

  } catch (err) {
    if (errorMsg) errorMsg.innerText = "Error: " + err.message;
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "Access Library";
    }
  }
};

window.handleRegister = async function() {
  const regBtn = document.getElementById('regBtn');
  const usernameInput = document.getElementById('regUsername');
  const codeInput = document.getElementById('regCode');
  const errorMsg = document.getElementById('error-msg');
  if (errorMsg) errorMsg.innerText = "";

  const username = usernameInput ? usernameInput.value.trim() : "";
  const code = codeInput ? codeInput.value.trim() : "";

  if (!username || !code) {
    if (errorMsg) errorMsg.innerText = "Please provide both a username and invite code.";
    return;
  }

  const db = initSupabase();
  if (!db) {
    if (errorMsg) errorMsg.innerText = "Database client failed to load. Please refresh.";
    return;
  }

  if (regBtn) {
    regBtn.disabled = true;
    regBtn.innerText = "Registering...";
  }

  try {
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .ilike('username', username);

    if (existingUser && existingUser.length > 0) {
      if (errorMsg) errorMsg.innerText = "Username is already taken. Choose another.";
      return;
    }

    const { data: inviteData, error: inviteErr } = await db
      .from('invites')
      .select('*')
      .eq('code', code)
      .eq('is_used', false);

    if (inviteErr || !inviteData || inviteData.length === 0) {
      if (errorMsg) errorMsg.innerText = "Invalid or already used invite code.";
      return;
    }

    const validInvite = inviteData[0];

    const { data: newUser, error: userErr } = await db
      .from('users')
      .insert([{
        username: username,
        invite_code: code,
        invited_by: validInvite.created_by,
        is_active: true
      }])
      .select();

    if (userErr || !newUser) {
      if (errorMsg) errorMsg.innerText = "Registration failed: " + userErr.message;
      return;
    }

    await db
      .from('invites')
      .update({ is_used: true, used_by: username })
      .eq('id', validInvite.id);

    localStorage.setItem('tsda_user_session', JSON.stringify(newUser[0]));
    unlockUI(newUser[0]);

  } catch (err) {
    if (errorMsg) errorMsg.innerText = "Error: " + err.message;
  } finally {
    if (regBtn) {
      regBtn.disabled = false;
      regBtn.innerText = "Register & Log In";
    }
  }
};

window.generateInvite = async function() {
  const user = JSON.parse(localStorage.getItem('tsda_user_session'));
  const db = initSupabase();
  if (!user || !db) return;

  const newCode = 'INVITE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await db
    .from('invites')
    .insert([{
      code: newCode,
      created_by: user.username,
      is_used: false
    }]);

  if (error) {
    alert("Error generating code: " + error.message);
    return;
  }

  const inviteBox = document.getElementById('invite-box');
  if (inviteBox) {
    inviteBox.innerHTML = `Single-use Invite Code for a friend: <strong>${newCode}</strong>`;
  }
};

window.handleLogout = function() {
  localStorage.removeItem('tsda_user_session');
  location.reload();
};

function unlockUI(user) {
  const overlay = document.getElementById('login-overlay');
  const app = document.getElementById('app-container');
  if (overlay) overlay.style.display = 'none';
  if (app) app.style.display = 'block';

  const userStatus = document.getElementById('user-status-text');
  if (userStatus) {
    userStatus.innerText = `Logged in as: ${user.username} (Invited by: ${user.invited_by})`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  const activeUser = JSON.parse(localStorage.getItem('tsda_user_session'));
  if (activeUser) unlockUI(activeUser);
});
