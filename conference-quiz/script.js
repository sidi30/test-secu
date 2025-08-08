// Quiz App - Données sensibles & Sécurité applicative
// Features: category filter, timer/question, progress, feedback, explanations, local leaderboard, export results

const state = {
  allQuestions: [],
  quiz: [],
  index: 0,
  correct: 0,
  perQuestion: 30,
  timerId: null,
  secondsLeft: 30,
  nickname: '',
  category: 'mix',
  results: [],
  remoteEndpoint: '',
};

const els = {
  intro: document.getElementById('intro'),
  setupForm: document.getElementById('setupForm'),
  nickname: document.getElementById('nickname'),
  category: document.getElementById('category'),
  count: document.getElementById('count'),
  perQuestion: document.getElementById('perQuestion'),

  quiz: document.getElementById('quiz'),
  progressBar: document.getElementById('progressBar'),
  counter: document.getElementById('counter'),
  timer: document.getElementById('timer'),
  questionText: document.getElementById('questionText'),
  answers: document.getElementById('answers'),
  feedback: document.getElementById('feedback'),
  nextBtn: document.getElementById('nextBtn'),

  results: document.getElementById('results'),
  scoreText: document.getElementById('scoreText'),
  review: document.getElementById('review'),
  restartBtn: document.getElementById('restartBtn'),

  board: document.getElementById('board'),
  globalBoard: document.getElementById('globalBoard'),
  exportBtn: document.getElementById('exportBtn'),
};

async function loadConfig() {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();
    state.remoteEndpoint = (cfg.remoteEndpoint || '').trim();
  } catch (e) {
    console.warn('Config non chargée (optionnel):', e);
  }
}

async function sendResultRemote() {
  if (!state.remoteEndpoint) return;
  try {
    const payload = {
      nick: state.nickname || 'anonyme',
      score: state.correct,
      total: state.quiz.length,
      ts: Date.now(),
      category: state.category,
      details: state.results,
    };
    const body = new URLSearchParams({
      action: 'submit',
      data: JSON.stringify(payload)
    });
    const resp = await fetch(state.remoteEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.warn('Remote submit HTTP error', resp.status, text);
    } else {
      console.log('Remote submit OK', text);
    }
  } catch (e) {
    console.warn('Echec envoi résultat distant:', e);
  }
}

async function fetchGlobalBoard() {
  if (!state.remoteEndpoint) return [];
  try {
    const res = await fetch(state.remoteEndpoint + '?action=leaderboard', { mode: 'cors', cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Echec chargement leaderboard global:', e);
    return [];
  }
}

async function loadQuestions() {
  const res = await fetch('questions.json');
  if (!res.ok) {
    throw new Error('Impossible de charger questions.json');
  }
  const data = await res.json();
  state.allQuestions = data;
}

function pickQuestions(category, count) {
  let list = state.allQuestions;
  if (category !== 'mix') {
    list = list.filter(q => q.category === category);
  }
  // shuffle
  list = [...list].sort(() => Math.random() - 0.5);
  return list.slice(0, count);
}

function renderQuestion() {
  const q = state.quiz[state.index];
  if (!q) return;
  els.questionText.textContent = q.text;
  els.answers.innerHTML = '';
  els.feedback.className = 'feedback';
  els.feedback.textContent = '';
  els.nextBtn.disabled = true;

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn answer';
    btn.innerHTML = `<span class="letter">${String.fromCharCode(65+i)}</span> ${opt}`;
    btn.addEventListener('click', () => onAnswer(i));
    els.answers.appendChild(btn);
  });

  els.counter.textContent = `${state.index+1}/${state.quiz.length}`;
  const progress = ((state.index) / state.quiz.length) * 100;
  els.progressBar.style.width = `${progress}%`;
  startTimer();
}

function startTimer() {
  clearInterval(state.timerId);
  state.secondsLeft = state.perQuestion;
  els.timer.textContent = `${state.secondsLeft}s`;
  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    els.timer.textContent = `${state.secondsLeft}s`;
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      lockQuestion(null); // no answer
    }
  }, 1000);
}

function lockQuestion(choiceIndex) {
  // Disable answers
  [...els.answers.children].forEach(b => b.disabled = true);
  const q = state.quiz[state.index];
  const correct = q.answer;
  const ok = choiceIndex === correct;
  if (ok) state.correct += 1;

  // Style answers
  [...els.answers.children].forEach((b, i) => {
    if (i === correct) {
      b.style.borderColor = 'rgba(34,197,94,.8)';
    }
    if (i === choiceIndex && i !== correct) {
      b.style.borderColor = 'rgba(239,68,68,.8)';
    }
  });

  // Feedback block
  els.feedback.className = 'feedback ' + (ok ? 'ok' : 'ko');
  els.feedback.innerHTML = `${ok ? '✅ Bonne réponse !' : '❌ Mauvaise réponse.'}<div class="explain">${q.explain || ''}</div>`;

  state.results.push({
    question: q.text,
    chosen: choiceIndex,
    correct,
    options: q.options,
    explain: q.explain
  });

  els.nextBtn.disabled = false;
}

function onAnswer(i) {
  clearInterval(state.timerId);
  lockQuestion(i);
}

function next() {
  if (state.index < state.quiz.length - 1) {
    state.index += 1;
    renderQuestion();
  } else {
    finish();
  }
}

function finish() {
  els.quiz.classList.add('hidden');
  els.results.classList.remove('hidden');
  els.scoreText.textContent = `Score: ${state.correct}/${state.quiz.length}`;
  els.review.innerHTML = '';
  state.results.forEach((r, idx) => {
    const div = document.createElement('div');
    div.className = 'review-item';
    const chosenLabel = r.chosen == null ? '—' : `${String.fromCharCode(65 + r.chosen)}. ${r.options[r.chosen]}`;
    const correctLabel = `${String.fromCharCode(65 + r.correct)}. ${r.options[r.correct]}`;
    div.innerHTML = `
      <div class="q">${idx+1}. ${r.question}</div>
      <div class="res">Votre réponse: <span class="${r.chosen === r.correct ? 'good' : 'bad'}">${chosenLabel}</span></div>
      <div class="res">Bonne réponse: <span class="good">${correctLabel}</span></div>
      <div class="explain">${r.explain || ''}</div>
    `;
    els.review.appendChild(div);
  });
  saveToBoard();
  renderBoard();
  // Remote submit + refresh global board (best-effort)
  sendResultRemote().then(() => renderGlobalBoard());
}

function restart() {
  els.results.classList.add('hidden');
  els.intro.classList.remove('hidden');
}

function saveToBoard() {
  const board = JSON.parse(localStorage.getItem('quiz_board') || '[]');
  const item = {
    nick: state.nickname || 'anonyme',
    score: state.correct,
    total: state.quiz.length,
    ts: Date.now(),
    category: state.category,
  };
  board.push(item);
  board.sort((a,b) => b.score - a.score || a.total - b.total || b.ts - a.ts);
  const trimmed = board.slice(0, 20);
  localStorage.setItem('quiz_board', JSON.stringify(trimmed));
}

function renderBoard() {
  const board = JSON.parse(localStorage.getItem('quiz_board') || '[]');
  els.board.innerHTML = '';
  board.forEach(entry => {
    const li = document.createElement('li');
    const date = new Date(entry.ts).toLocaleString();
    li.textContent = `${entry.nick} — ${entry.score}/${entry.total} (${entry.category}) · ${date}`;
    els.board.appendChild(li);
  });
}

async function renderGlobalBoard() {
  if (!els.globalBoard) return;
  els.globalBoard.innerHTML = '';
  if (!state.remoteEndpoint) {
    const li = document.createElement('li');
    li.textContent = 'Configurer un endpoint distant dans config.json pour activer le classement global.';
    els.globalBoard.appendChild(li);
    return;
  }
  const g = await fetchGlobalBoard();
  if (!g.length) {
    const li = document.createElement('li');
    li.textContent = 'Aucune entrée globale pour le moment.';
    els.globalBoard.appendChild(li);
    return;
  }
  g.forEach(entry => {
    const li = document.createElement('li');
    const date = new Date(entry.ts).toLocaleString();
    li.textContent = `${entry.nick} — ${entry.score}/${entry.total} (${entry.category}) · ${date}`;
    els.globalBoard.appendChild(li);
  });
}

function exportResults() {
  const payload = {
    meta: {
      title: 'Quiz Données sensibles & Sécurité applicative',
      generatedAt: new Date().toISOString(),
      category: state.category,
      perQuestion: state.perQuestion,
    },
    results: state.results,
    score: { correct: state.correct, total: state.quiz.length },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quiz-resultats.json';
  a.click();
  URL.revokeObjectURL(url);
}

els.nextBtn.addEventListener('click', next);
els.restartBtn.addEventListener('click', restart);
els.exportBtn.addEventListener('click', exportResults);

els.setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (!state.allQuestions.length) await loadQuestions();
    state.nickname = els.nickname.value.trim();
    state.category = els.category.value;
    state.perQuestion = parseInt(els.perQuestion.value, 10) || 30;
    const count = parseInt(els.count.value, 10) || 10;

    state.quiz = pickQuestions(state.category, count);
    if (!state.quiz.length) {
      alert('Aucune question pour cette catégorie.');
      return;
    }
    state.index = 0;
    state.correct = 0;
    state.results = [];

    els.intro.classList.add('hidden');
    els.quiz.classList.remove('hidden');

    renderQuestion();
  } catch (err) {
    console.error(err);
    alert('Erreur de chargement. Vérifiez que questions.json est accessible.');
  }
});

// Initial
(async function init() {
  await loadConfig();
  renderBoard();
  renderGlobalBoard();
})();
