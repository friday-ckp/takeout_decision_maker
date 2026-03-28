/**
 * settings.js — Story 4.2 设置页前端
 */

let currentSettings = { daily_replay_limit: 3, history_exclude_days: 3 };

async function loadSettings() {
  try {
    currentSettings = await api.get('/api/settings');
    renderSettings();
  } catch (err) {
    console.warn('设置加载失败:', err.message);
  }
}

function renderSettings() {
  const replayInput   = document.getElementById('setting-replay-limit');
  const excludeInput  = document.getElementById('setting-exclude-days');

  if (replayInput)  replayInput.value  = currentSettings.daily_replay_limit;
  if (excludeInput) excludeInput.value = currentSettings.history_exclude_days;
}

async function saveSettings() {
  const replayInput  = document.getElementById('setting-replay-limit');
  const excludeInput = document.getElementById('setting-exclude-days');
  const saveBtn      = document.getElementById('btn-save-settings');

  const daily_replay_limit   = parseInt(replayInput?.value, 10);
  const history_exclude_days = parseInt(excludeInput?.value, 10);

  if (isNaN(daily_replay_limit) || daily_replay_limit < 1 || daily_replay_limit > 10) {
    showToast('每日重玩次数应在 1~10 之间', 'error');
    return;
  }
  if (isNaN(history_exclude_days) || history_exclude_days < 0 || history_exclude_days > 30) {
    showToast('历史排除天数应在 0~30 之间', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';

  try {
    currentSettings = await api.patch('/api/settings', {
      daily_replay_limit,
      history_exclude_days,
    });
    showToast('设置已保存', 'success');
    renderSettings();
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存设置';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  registerPage('settings', { onEnter: loadSettings });

  document.getElementById('btn-save-settings')
    ?.addEventListener('click', saveSettings);
});
