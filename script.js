const addBtn = document.getElementById('add-poo');
const todayCountEl = document.getElementById('today-count');
const lastLogEl = document.getElementById('last-log');
const resetDayBtn = document.getElementById('reset-day');
const clearAllBtn = document.getElementById('clear-all');
const chartEl = document.getElementById('chart');
const insightEl = document.getElementById('insight');
const enableRemindersBtn = document.getElementById('enable-reminders');
const lastReminderEl = document.getElementById('last-reminder');
const weekCalendarEl = document.getElementById('week-calendar');

const cycleStartInput = document.getElementById('cycle-start');
const cycleLengthInput = document.getElementById('cycle-length');
const periodLengthInput = document.getElementById('period-length');
const saveCycleBtn = document.getElementById('save-cycle');
const cycleSummaryEl = document.getElementById('cycle-summary');

const STORAGE_KEYS = {
  POOPS: 'poopLogs',
  CYCLE: 'cycleInfo',
  REMINDER: 'reminderRequested',
  LAST_REMINDER: 'lastReminder'
};

function loadLogs() {
  const data = localStorage.getItem(STORAGE_KEYS.POOPS);
  return data ? JSON.parse(data) : [];
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.POOPS, JSON.stringify(logs));
}

function loadCycle() {
  const data = localStorage.getItem(STORAGE_KEYS.CYCLE);
  return data ? JSON.parse(data) : { start: '', length: 28, period: 5 };
}

function saveCycle(cycle) {
  localStorage.setItem(STORAGE_KEYS.CYCLE, JSON.stringify(cycle));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function todayKey() {
  return formatDate(new Date());
}

function logPoo() {
  const logs = loadLogs();
  const key = todayKey();
  const existing = logs.find((entry) => entry.date === key);
  if (existing) {
    existing.count += 1;
  } else {
    logs.push({ date: key, count: 1, timestamp: Date.now() });
  }
  saveLogs(logs);
  render();
}

function resetToday() {
  const logs = loadLogs();
  const key = todayKey();
  const filtered = logs.filter((entry) => entry.date !== key);
  saveLogs(filtered);
  render();
}

function clearAll() {
  localStorage.removeItem(STORAGE_KEYS.POOPS);
  localStorage.removeItem(STORAGE_KEYS.CYCLE);
  localStorage.removeItem(STORAGE_KEYS.LAST_REMINDER);
  render();
}

function renderToday(logs) {
  const key = todayKey();
  const today = logs.find((entry) => entry.date === key);
  todayCountEl.textContent = today ? today.count : 0;
  const lastLog = logs.slice().sort((a, b) => b.timestamp - a.timestamp)[0];
  lastLogEl.textContent = lastLog ? new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function isDuringPeriod(date, cycle) {
  if (!cycle.start) return false;
  const startDate = new Date(cycle.start);
  const diff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
  if (diff < 0) return false;
  const dayInCycle = (diff % cycle.length) + 1;
  return dayInCycle <= cycle.period;
}

function dayInCycle(date, cycle) {
  if (!cycle.start) return null;
  const startDate = new Date(cycle.start);
  const diff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  return (diff % cycle.length) + 1;
}

function renderChart(logs, cycle) {
  chartEl.innerHTML = '';
  const sorted = logs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const last14 = [];
  const today = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const key = formatDate(date);
    const entry = sorted.find((item) => item.date === key);
    last14.push({ date, count: entry ? entry.count : 0 });
  }

  const max = Math.max(3, ...last14.map((d) => d.count));
  last14.forEach(({ date, count }) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${(count / max) * 100}%`;
    bar.dataset.label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (isDuringPeriod(date, cycle)) {
      bar.classList.add('period');
    }
    if (count > 0) {
      const bubble = document.createElement('span');
      bubble.textContent = count;
      bar.appendChild(bubble);
    }
    chartEl.appendChild(bar);
  });
}

function renderWeekCalendar(logs, cycle) {
  if (!weekCalendarEl) return;
  weekCalendarEl.innerHTML = '';
  const today = new Date();
  const sorted = logs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const key = formatDate(date);
    const entry = sorted.find((item) => item.date === key);
    const count = entry ? entry.count : 0;
    const card = document.createElement('div');
    card.className = 'day-card';
    if (formatDate(today) === key) card.classList.add('today');

    const top = document.createElement('div');
    top.className = 'top-row';
    top.innerHTML = `<span>${date.toLocaleDateString([], { weekday: 'short' })}</span><span>${date.getDate()}</span>`;

    const countEl = document.createElement('p');
    countEl.className = 'count';
    countEl.textContent = count;

    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = count === 1 ? '1 log' : `${count} logs`;

    if (isDuringPeriod(date, cycle)) {
      pill.classList.add('period');
      pill.textContent += ' • period';
    }

    card.appendChild(top);
    card.appendChild(countEl);
    card.appendChild(pill);
    weekCalendarEl.appendChild(card);
  }
}

function generateInsight(logs, cycle) {
  if (!logs.length) {
    insightEl.textContent = 'No logs yet. Tap "I just went" to start the pattern party!';
    return;
  }
  const periodLogs = logs.filter((log) => isDuringPeriod(new Date(log.date), cycle));
  const nonPeriodLogs = logs.filter((log) => !isDuringPeriod(new Date(log.date), cycle));
  const avg = (arr) => arr.reduce((sum, l) => sum + l.count, 0) / (arr.length || 1);
  const periodAvg = avg(periodLogs).toFixed(1);
  const nonPeriodAvg = avg(nonPeriodLogs).toFixed(1);
  const lastCycleDay = dayInCycle(new Date(), cycle);

  const notes = [
    `On period days you average ${periodAvg} 🚽 visits.`,
    `During non-period days it's ${nonPeriodAvg}.`,
  ];
  if (lastCycleDay) {
    notes.push(`Today is cycle day ${lastCycleDay}. Keep an eye on tummy feels around days ${Math.max(1, lastCycleDay - 2)}-${lastCycleDay + 2}.`);
  }
  insightEl.textContent = notes.join(' ');
}

function renderCycle(cycle) {
  cycleStartInput.value = cycle.start;
  cycleLengthInput.value = cycle.length;
  periodLengthInput.value = cycle.period;
  if (!cycle.start) {
    cycleSummaryEl.textContent = 'Add your last period start to line up your body clock.';
    return;
  }
  const nextStart = new Date(cycle.start);
  while (nextStart < new Date()) {
    nextStart.setDate(nextStart.getDate() + cycle.length);
  }
  cycleSummaryEl.textContent = `Next expected period starts ${nextStart.toLocaleDateString([], { month: 'short', day: 'numeric' })}. Period length set to ${cycle.period} days.`;
}

function render() {
  const logs = loadLogs();
  const cycle = loadCycle();
  renderToday(logs);
  renderCycle(cycle);
  renderChart(logs, cycle);
  renderWeekCalendar(logs, cycle);
  generateInsight(logs, cycle);
  updateReminderInfo();
}

function saveCycleInfo() {
  const cycle = {
    start: cycleStartInput.value,
    length: parseInt(cycleLengthInput.value, 10) || 28,
    period: parseInt(periodLengthInput.value, 10) || 5,
  };
  saveCycle(cycle);
  render();
}

function requestReminders() {
  if (!('Notification' in window)) {
    lastReminderEl.textContent = 'Notifications are not supported in this browser.';
    return;
  }
  Notification.requestPermission().then((permission) => {
    const approved = permission === 'granted';
    localStorage.setItem(STORAGE_KEYS.REMINDER, approved);
    if (approved) {
      sendReminder('Time to tally your latest bathroom break? 💕');
      scheduleReminder();
    }
    updateReminderInfo();
  });
}

function sendReminder(message) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('Poo & Flow Tally', { body: message, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="%23ff8fb1"/><circle cx="24" cy="26" r="6" fill="%23fff"/><circle cx="40" cy="26" r="6" fill="%23fff"/><circle cx="24" cy="26" r="3" fill="%232f2535"/><circle cx="40" cy="26" r="3" fill="%232f2535"/><path d="M20 40c4 6 20 6 24 0" stroke="%232f2535" stroke-width="5" fill="none" stroke-linecap="round"/></svg>' });
  localStorage.setItem(STORAGE_KEYS.LAST_REMINDER, Date.now());
  n.onclick = () => window.focus();
}

let reminderInterval;
function scheduleReminder() {
  if (reminderInterval) clearInterval(reminderInterval);
  if (localStorage.getItem(STORAGE_KEYS.REMINDER) !== 'true') return;
  reminderInterval = setInterval(() => {
    sendReminder('Quick check: log your latest trip! 💖');
  }, 1000 * 60 * 60 * 3); // every 3 hours while open
}

function updateReminderInfo() {
  const enabled = localStorage.getItem(STORAGE_KEYS.REMINDER) === 'true';
  if (!enabled) {
    lastReminderEl.textContent = 'Reminders are off. Enable to get gentle nudges.';
    return;
  }
  const last = localStorage.getItem(STORAGE_KEYS.LAST_REMINDER);
  if (!last) {
    lastReminderEl.textContent = 'Reminders on. Next nudge in ~3 hours while this tab is open.';
  } else {
    const diff = Math.round((Date.now() - Number(last)) / (1000 * 60));
    lastReminderEl.textContent = `Last nudge ${diff} min ago. Next in ~3 hours while open.`;
  }
}

function hydrateFromStorage() {
  render();
  if (localStorage.getItem(STORAGE_KEYS.REMINDER) === 'true') {
    scheduleReminder();
  }
}

addBtn.addEventListener('click', logPoo);
resetDayBtn.addEventListener('click', resetToday);
clearAllBtn.addEventListener('click', clearAll);
saveCycleBtn.addEventListener('click', saveCycleInfo);
enableRemindersBtn.addEventListener('click', requestReminders);

document.addEventListener('DOMContentLoaded', hydrateFromStorage);
