const SUPABASE_URL = 'https://zlilrvqbkshefyhvauml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsaWxydnFia3NoZWZ5aHZhdW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMjkzNTcsImV4cCI6MjEwODcwNTM1N30.Yrgfoh9c-rjeqRlzOdcEkSLKFYSRtWEtPBMxzOje2dU';

let supabase;

function getSupabaseClient() {
  if (!supabase && window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

document.addEventListener('DOMContentLoaded', () => {
  // Bind tab buttons
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  if (tabLogin) tabLogin.onclick = () => switchTab('login');
  if (tabRegister) tabRegister.onclick = () => switchTab('register');

  // Bind submit buttons directly
  const loginBtn = document.getElementById('loginBtn');
  const regBtn = document.getElementById('regBtn');
  const genBtn = document.getElementById('gen-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginBtn) loginBtn.onclick = handleLogin;
  if (regBtn) regBtn.onclick = handleRegister;
  if (genBtn) genBtn.onclick = generateInvite;
  if (logoutBtn) logoutBtn.onclick = handleLogout;

  // Initialize client early
  getSupabaseClient();

  // Check cached session
  const activeUser = JSON.parse(localStorage.getItem('tsda_user_session'));
  if (activeUser) {
    unlockUI(activeUser);
  }
});

function switchTab(tab) {
  const errorMsg = document.getElementById('error-msg');
  if (errorMsg) errorMsg.innerText = "";

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.style.display = 'block';
    formLogin.style.display = 'none';
  }
}

async function handleLogin() {
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

  const client = getSupabaseClient();
  if (!client) {
    if (errorMsg) errorMsg.innerText = "Connecting to database... Please tap again in a second.";
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerText = "Checking...";
  }

  try {
    const isOwnerCode = (username.toLowerCase() === 'francis' && code === 'Fr@nc1s');

    const { data, error } = await client
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

    if (!userRecord.is_active && !isOwnerCode) {
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
}

async function handleRegister() {
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

  const client = getSupabaseClient();
  if (!client) {
    if (errorMsg) errorMsg.innerText = "Connecting to database... Please tap again in a second.";
    return;
  }

  if (regBtn) {
    regBtn.disabled = true;
    regBtn.innerText = "Registering...";
  }

  try {
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .ilike('username', username);

    if (existingUser && existingUser.length > 0) {
      if (errorMsg) errorMsg.innerText = "Username is already taken. Choose another.";
      return;
    }

    const { data: inviteData, error: inviteErr } = await client
      .from('invites')
      .select('*')
      .eq('code', code)
      .eq('is_used', false);

    if (inviteErr || !inviteData || inviteData.length === 0) {
      if (errorMsg) errorMsg.innerText = "Invalid or already used invite code.";
      return;
    }

    const validInvite = inviteData[0];

    const { data: newUser, error: userErr } = await client
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

    await client
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
}

function unlockUI(user) {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';

  const userStatus = document.getElementById('user-status-text');
  if (userStatus) {
    userStatus.innerText = `Logged in as: ${user.username} (Invited by: ${user.invited_by})`;
  }
}

async function generateInvite() {
  const user = JSON.parse(localStorage.getItem('tsda_user_session'));
  const client = getSupabaseClient();
  if (!user || !client) return;

  const newCode = 'INVITE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await client
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
}

function handleLogout() {
  localStorage.removeItem('tsda_user_session');
  location.reload();
}
