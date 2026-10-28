const SUPABASE_URL = 'https://zlilrvqbkshefyhvauml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsaWxydnFia3NoZWZ5aHZhdW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMjkzNTcsImV4cCI6MjEwODcwNTM1N30.Yrgfoh9c-rjeqRlzOdcEkSLKFYSRtWEtPBMxzOje2dU';

function getSupabaseClient() {
  if (window.supabase && window.supabase.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('gen-btn').addEventListener('click', generateInvite);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  const activeUser = JSON.parse(localStorage.getItem('tsda_user_session'));
  if (activeUser) {
    unlockUI(activeUser);
  }
});

async function handleLogin() {
  const loginBtn = document.getElementById('loginBtn');
  const codeInput = document.getElementById('inviteInput');
  const errorMsg = document.getElementById('error-msg');
  errorMsg.innerText = "";

  const code = codeInput.value.trim();

  if (!code) {
    errorMsg.innerText = "Please enter an invite code.";
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    errorMsg.innerText = "Network issue loading security library. Refresh and try again.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerText = "Checking...";

  try {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('invite_code', code);

    if (error) {
      errorMsg.innerText = "Database error: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      errorMsg.innerText = "Invalid invite code.";
      return;
    }

    const userRecord = data[0];
    const isOwnerCode = (code === 'Fr@nc1s');

    if (!userRecord.is_active && !isOwnerCode) {
      errorMsg.innerText = "This invite code has already been used or banned.";
      return;
    }

    const sessionToken = crypto.randomUUID();
    const updatePayload = { active_session_token: sessionToken };

    if (!isOwnerCode) {
      updatePayload.is_active = false;
    }

    await client
      .from('users')
      .update(updatePayload)
      .eq('id', userRecord.id);

    userRecord.active_session_token = sessionToken;
    localStorage.setItem('tsda_user_session', JSON.stringify(userRecord));

    unlockUI(userRecord);
  } catch (err) {
    errorMsg.innerText = "Error: " + err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerText = "Access Library";
  }
}

function unlockUI(user) {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';

  const userStatus = document.getElementById('user-status-text');
  if (userStatus) userStatus.innerText = `Logged in as: ${user.username}`;

  const inviteBox = document.getElementById('invite-box');
  const genBtn = document.getElementById('gen-btn');

  if (user.generated_code && inviteBox && genBtn) {
    inviteBox.innerHTML = `Your Generated Invite Code: <strong>${user.generated_code}</strong>`;
    genBtn.style.display = 'none';
  } else if (user.has_generated && inviteBox && genBtn) {
    inviteBox.innerText = `You have already used your single-generation slot.`;
    genBtn.style.display = 'none';
  }
}

async function generateInvite() {
  const user = JSON.parse(localStorage.getItem('tsda_user_session'));
  const client = getSupabaseClient();
  if (!user || user.has_generated || !client) return;

  const newCode = 'INVITE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await client
    .from('users')
    .insert([{
      username: `${user.username}_friend`,
      invite_code: newCode,
      invited_by: user.username,
      has_generated: false,
      is_active: true
    }]);

  if (error) {
    alert("Error generating code: " + error.message);
    return;
  }

  await client
    .from('users')
    .update({ has_generated: true, generated_code: newCode })
    .eq('id', user.id);

  user.has_generated = true;
  user.generated_code = newCode;
  localStorage.setItem('tsda_user_session', JSON.stringify(user));

  const inviteBox = document.getElementById('invite-box');
  const genBtn = document.getElementById('gen-btn');
  if (inviteBox && genBtn) {
    inviteBox.innerHTML = `Your Generated Invite Code: <strong>${newCode}</strong>`;
    genBtn.style.display = 'none';
  }
}

function handleLogout() {
  localStorage.removeItem('tsda_user_session');
  location.reload();
}
