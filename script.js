/**
 * script.js - 분수 마스터 메인 게임 엔진
 * =====================================================
 * 게임의 모든 로직을 관리합니다.
 * - 화면 전환
 * - 문제 렌더링
 * - 정답/오답 처리
 * - XP 시스템
 * - LocalStorage 저장/불러오기
 * - 효과음 (Web Audio API)
 * - 학생 프로필 관리
 * =====================================================
 */

'use strict';

// ─────────────────────────────────────────────────────────
// 상수 & 설정
// ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'fractionMaster';
const QUESTIONS_PER_LEVEL = 10;
// ─────────────────────────────────────────────────────────
//
// ▶ 설정 방법 (같은 이름으로 모든 기기에서 기록 공유)
//   1. https://console.firebase.google.com → 새 프로젝트 만들기
//   2. 왼쪽 메뉴 → Realtime Database → "데이터베이스 만들기"
//   3. 테스트 모드로 시작 → "완료" 클릭
//   4. 상단에 표시되는 URL 복사
//      예) https://my-project-default-rtdb.firebaseio.com
//   5. 아래 FIREBASE_URL 에 붙여넣기 (끝에 / 없이)
//
// ▶ 비워두면 기기별 로컬 저장소만 사용합니다 (기존 방식 유지).
const FIREBASE_URL = 'https://fraction-master-67969-default-rtdb.firebaseio.com'; // ← 여기에 Firebase URL 붙여넣기

/** 학생 이름을 Firebase 경로용 안전한 키로 변환 */
function nameToKey(name) {
    // Firebase 경로에서 금지된 문자(. # $ / [ ]) 처리
    return encodeURIComponent(name).replace(/\./g, '%2E');
}

/**
 * Firebase에서 학생 데이터를 불러옵니다 (3초 타임아웃).
 * 오프라인이거나 Firebase 미설정이면 null 반환.
 */
async function loadStudentFromCloud(name) {
    if (!FIREBASE_URL) return null;
    try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 3000);
        const res  = await fetch(
            `${FIREBASE_URL}/fractionMaster/${nameToKey(name)}.json`,
            { signal: ctrl.signal }
        );
        clearTimeout(tid);
        if (!res.ok) return null;
        return await res.json(); // 데이터 없으면 null
    } catch {
        return null; // 오프라인 / 타임아웃 → 조용히 무시
    }
}

/**
 * 학생 데이터를 Firebase에 저장합니다 (비동기, 실패 무시).
 */
async function saveStudentToCloud(name, studentData) {
    if (!FIREBASE_URL || !name || !studentData) return;
    try {
        await fetch(
            `${FIREBASE_URL}/fractionMaster/${nameToKey(name)}.json`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData),
                keepalive: true  // 페이지 닫힌 뒤에도 요청 완료
            }
        );
    } catch {
        // 저장 실패해도 로컬엔 저장됐으므로 무시
    }
}

/**
 * 로컬 vs 클라우드 중 더 진행된 데이터를 반환합니다.
 * 기준: totalXP가 더 높은 쪽 (둘 다 없으면 cloud 우선)
 */
function mergeStudentData(local, cloud) {
    if (!local) return cloud;
    if (!cloud) return local;
    return (cloud.totalXP || 0) >= (local.totalXP || 0) ? cloud : local;
}

// 클라우드 저장 디바운스 타이머 (잦은 저장 방지 — 마지막 후 3초)
let _cloudSaveTimer = null;

function scheduleCloudSave(name, studentData) {
    if (!FIREBASE_URL) return;
    if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => {
        saveStudentToCloud(name, studentData).catch(() => {});
        _cloudSaveTimer = null;
    }, 3000);
}

function flushCloudSave(name, studentData) {
    if (!FIREBASE_URL) return;
    if (_cloudSaveTimer) { clearTimeout(_cloudSaveTimer); _cloudSaveTimer = null; }
    saveStudentToCloud(name, studentData).catch(() => {});
}

/**
 * 클라우드와 백그라운드 동기화.
 * 클라우드가 더 최신이면 로컬을 갱신하고 맵 화면을 업데이트합니다.
 */
async function syncFromCloud(name) {
    const cloudData = await loadStudentFromCloud(name);
    if (!cloudData) return;

    const data  = loadData();
    const local = data.students[name];
    const merged = mergeStudentData(local, cloudData);

    if (merged !== local) {
        // 클라우드 데이터가 더 진행됨 → 로컬 갱신
        data.students[name] = merged;
        saveData(data);
        if (gameState.currentStudent === name) {
            const mapActive = document.getElementById('screen-map')
                                      .classList.contains('active');
            if (mapActive) {
                initMapScreen();
                showToast('☁️ 다른 기기 기록으로 동기화됐어요!');
            }
        }
    }
}


const XP_PER_CORRECT = 10;
const XP_PER_LEVEL_BONUS = 100;
const XP_PER_LEVEL = 200; // 레벨 진행도 표시용

const LEVEL_NAMES = [
    '', // 인덱스 0 패딩
    '분수 읽기',
    '단위분수',
    '진분수·가분수',
    '크기가 같은 분수',
    '약분',
    '공배수',
    '최소공배수',
    '통분',
    '분수 비교',
    '분수 덧셈',
    '분수 뺄셈'
];

const LEVEL_ICONS = [
    '',
    '📖', '🔢', '⚖️', '🔄', '✂️',
    '🔗', '🏆', '🎯', '🔍', '➕', '➖'
];

const CHARACTERS = [
    { minLevel: 1,  maxLevel: 2,  icon: '🌱', name: '분수 새싹' },
    { minLevel: 3,  maxLevel: 4,  icon: '⚔️', name: '분수 모험가' },
    { minLevel: 5,  maxLevel: 7,  icon: '🛡️', name: '분수 기사' },
    { minLevel: 8,  maxLevel: 9,  icon: '🔮', name: '분수 마법사' },
    { minLevel: 10, maxLevel: 11, icon: '👑', name: '분수 마스터' }
];

const TOTAL_LEVELS = 11;

// ─────────────────────────────────────────────────────────
// 게임 상태 (gameState)
// ─────────────────────────────────────────────────────────

let gameState = {
    currentStudent: '',      // 현재 플레이어 이름
    currentLevel: 1,         // 현재 게임 레벨
    questions: [],           // 현재 레벨 문제 배열
    questionIndex: 0,        // 현재 문제 인덱스
    correctCount: 0,         // 이번 레벨 정답 수
    wrongCount: 0,           // 이번 레벨 오답 수
    answered: false,         // 현재 문제 답변 여부
    retryMode: false,        // 오답 재출제 모드
    retryQuestion: null,     // 재출제할 문제
    fromScreen: 'map',       // 진단/기록 진입 이전 화면
    audioCtx: null           // Web Audio 컨텍스트
};

// ─────────────────────────────────────────────────────────
// 데이터 저장/불러오기 (LocalStorage)
// ─────────────────────────────────────────────────────────

/** 전체 앱 데이터를 LocalStorage에서 불러옵니다 */
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { currentStudent: '', students: {} };
        return JSON.parse(raw);
    } catch (e) {
        console.warn('데이터 로드 오류, 초기화합니다.', e);
        return { currentStudent: '', students: {} };
    }
}

/** 전체 앱 데이터를 LocalStorage에 저장합니다 */
function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('데이터 저장 오류:', e);
    }
}

/** 기본 학생 데이터 구조를 반환합니다 */
function createDefaultStudentData() {
    return {
        currentLevel:  1,
        maxLevel:      1,
        totalXP:       0,
        correctCount:  0,
        wrongCount:    0,
        wrongNotes:    [],
        levelProgress: {},
        lastPlayed:    new Date().toLocaleDateString('ko-KR')
    };
}

/** 현재 학생 데이터를 가져옵니다 */
function getCurrentStudentData() {
    const data = loadData();
    const name = gameState.currentStudent;
    if (!name) return null;
    if (!data.students[name]) {
        data.students[name] = createDefaultStudentData();
        saveData(data);
    }
    return data.students[name];
}

/** 현재 학생 데이터를 업데이트합니다 */
/**
 * 현재 학생 데이터를 업데이트합니다.
 * @param {object}  updates   - 업데이트할 데이터
 * @param {boolean} saveNow   - true: 즉시 클라우드 저장 (레벨 완료 시)
 *                              false: 3초 디바운스 후 저장 (문제 풀이 중)
 */
function updateCurrentStudentData(updates, saveNow = false) {
    const data = loadData();
    const name = gameState.currentStudent;
    if (!name) return;
    if (!data.students[name]) {
        data.students[name] = createDefaultStudentData();
    }
    Object.assign(data.students[name], updates);
    data.students[name].lastPlayed = new Date().toLocaleDateString('ko-KR');
    saveData(data);

    // 클라우드 동기화
    if (saveNow) {
        flushCloudSave(name, data.students[name]);   // 즉시 저장
    } else {
        scheduleCloudSave(name, data.students[name]); // 디바운스 저장
    }
}

/** 오답을 노트에 추가합니다 */
function addToWrongNotes(question, myAnswer, correctAnswer) {
    const data   = loadData();
    const name   = gameState.currentStudent;
    if (!name) return;
    if (!data.students[name]) data.students[name] = createDefaultStudentData();

    const notes = data.students[name].wrongNotes || [];

    // 중복 체크 (같은 문제가 이미 있으면 업데이트)
    const existIdx = notes.findIndex(n => n.question === question.question && n.level === gameState.currentLevel);
    const noteEntry = {
        level:           gameState.currentLevel,
        levelName:       LEVEL_NAMES[gameState.currentLevel],
        question:        question.question,
        display:         question.display,
        options:         question.options,
        correct:         question.correct,
        hint:            question.hint,
        myAnswer:        myAnswer,
        correctAnswer:   correctAnswer,
        addedAt:         new Date().toLocaleDateString('ko-KR'),
        wrongCount:      existIdx >= 0 ? (notes[existIdx].wrongCount || 1) + 1 : 1
    };

    if (existIdx >= 0) {
        notes[existIdx] = noteEntry;
    } else {
        notes.push(noteEntry);
    }

    // 최대 50개 유지 (오래된 것 제거)
    if (notes.length > 50) notes.shift();

    data.students[name].wrongNotes = notes;
    saveData(data);
}

// ─────────────────────────────────────────────────────────
// 화면 전환
// ─────────────────────────────────────────────────────────

/** 특정 화면을 표시합니다 */
function showScreen(screenId) {
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // 목표 화면 표시
    const target = document.getElementById(`screen-${screenId}`);
    if (!target) return;
    target.classList.add('active');

    // HUD 표시 여부
    const hudScreens = ['map', 'game', 'diagnosis', 'records', 'notes'];
    const showHud    = hudScreens.includes(screenId) && gameState.currentStudent;
    document.getElementById('hud').classList.toggle('visible', !!showHud);
    document.getElementById('xp-bar-wrap').classList.toggle('visible', !!showHud);

    // 화면별 초기화 함수 호출
    switch (screenId) {
        case 'main':       initMainScreen();       break;
        case 'name':       initNameScreen();       break;
        case 'map':        initMapScreen();        break;
        case 'diagnosis':  initDiagnosisScreen();  break;
        case 'records':    initRecordsScreen();    break;
        case 'notes':      initNotesScreen();      break;
        case 'teacher':    initTeacherScreen();    break;
    }

    // 스크롤 맨 위로
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────
// 화면 초기화 함수들
// ─────────────────────────────────────────────────────────

function initMainScreen() {
    const data      = loadData();
    const students  = Object.keys(data.students || {});
    const container = document.getElementById('main-quick-profiles');
    const list      = document.getElementById('main-profile-list');

    if (students.length > 0) {
        container.style.display = 'block';
        list.innerHTML = students.map(name => {
            const st  = data.students[name];
            const lvl = st.currentLevel || 1;
            const xp  = st.totalXP      || 0;
            return `<div class="profile-item" onclick="selectProfile('${escapeAttr(name)}')">
                <span class="pi-name">${escapeHTML(name)}</span>
                <span class="pi-level">레벨 ${lvl}</span>
                <span class="pi-xp">⚡${xp} XP</span>
            </div>`;
        }).join('');
    } else {
        container.style.display = 'none';
    }
}

function initNameScreen() {
    const input = document.getElementById('name-input');
    input.value = '';
    setTimeout(() => input.focus(), 100);

    // 저장된 프로필 목록
    const data     = loadData();
    const students = Object.keys(data.students || {});
    const wrap     = document.getElementById('saved-profiles-wrap');
    const list     = document.getElementById('saved-profiles-list');

    if (students.length > 0) {
        wrap.style.display = 'block';
        list.innerHTML = students.map(name => {
            const st = data.students[name];
            return `<div class="profile-item" onclick="selectProfile('${escapeAttr(name)}')">
                <span class="pi-name">${escapeHTML(name)}</span>
                <span class="pi-level">레벨 ${st.currentLevel || 1}</span>
                <span class="pi-xp">⚡${st.totalXP || 0} XP</span>
            </div>`;
        }).join('');
    } else {
        wrap.style.display = 'none';
    }
}

function initMapScreen() {
    if (!gameState.currentStudent) { showScreen('name'); return; }

    const studentData = getCurrentStudentData();
    if (!studentData) return;

    const curLevelRaw = studentData.currentLevel || 1;
    const isAllDone   = curLevelRaw > TOTAL_LEVELS;
    const displayLevel = Math.min(curLevelRaw, TOTAL_LEVELS);

    // 캐릭터 표시
    const char = getCharacterInfo(curLevelRaw);
    document.getElementById('char-icon').textContent   = char.icon;
    document.getElementById('char-name').textContent   = char.name;
    document.getElementById('char-level-label').textContent =
        isAllDone ? '전체 완료 👑' : `레벨 ${displayLevel}`;
    document.getElementById('map-greeting').textContent = `${gameState.currentStudent}의 모험 🗺️`;

    // XP 바
    const xpInLevel = studentData.totalXP % XP_PER_LEVEL;
    const xpPercent = Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100);
    document.getElementById('map-xp-bar').style.width   = xpPercent + '%';
    document.getElementById('map-xp-label').textContent = `⚡ ${studentData.totalXP} XP`;

    // HUD 업데이트
    updateHUD(studentData);

    // 레벨 그리드 렌더링
    renderLevelGrid(studentData);
}

function initDiagnosisScreen() {
    if (!gameState.currentStudent) { showScreen('name'); return; }
    const studentData = getCurrentStudentData();
    if (!studentData) return;

    const diagData  = diagnoseAll(studentData);
    const container = document.getElementById('diagnosis-content');
    container.innerHTML = renderDiagnosisHTML(diagData);

    // 진행 바 애니메이션 (렌더 후 지연)
    setTimeout(() => {
        container.querySelectorAll('.lri-bar-fill').forEach(bar => {
            const w = bar.style.width;
            bar.style.width = '0';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { bar.style.width = w; });
            });
        });
    }, 100);
}

function initRecordsScreen() {
    if (!gameState.currentStudent) { showScreen('name'); return; }
    const studentData = getCurrentStudentData();
    if (!studentData) return;

    const lp   = studentData.levelProgress || {};
    const tot  = studentData.correctCount  + studentData.wrongCount;
    const acc  = tot > 0 ? Math.round((studentData.correctCount / tot) * 100) : 0;

    document.getElementById('rec-total-xp').textContent  = (studentData.totalXP || 0).toLocaleString();
    document.getElementById('rec-max-level').textContent  = studentData.maxLevel || 1;
    document.getElementById('rec-correct').textContent    = studentData.correctCount || 0;
    document.getElementById('rec-accuracy').textContent   = acc + '%';

    // 레벨별 상세
    const detail = document.getElementById('records-level-detail');
    let html = '';
    for (let lv = 1; lv <= TOTAL_LEVELS; lv++) {
        const p   = lp[lv];
        if (!p) {
            html += `<div class="level-result-item" style="opacity:0.4">
                <div class="lri-header">
                    <span class="lri-emoji">${LEVEL_ICONS[lv]}</span>
                    <span class="lri-name">레벨 ${lv}: ${LEVEL_NAMES[lv]}</span>
                    <span class="lri-score" style="color:var(--txt-dim)">미도전</span>
                </div>
            </div>`;
            continue;
        }
        const total  = (p.correct || 0) + (p.wrong || 0);
        const lvAcc  = total > 0 ? Math.round((p.correct / total) * 100) : 0;
        const barCol = lvAcc >= 80 ? 'var(--clr-green)' : lvAcc >= 60 ? 'var(--clr-orange)' : 'var(--clr-red)';
        const emoji  = p.completed ? (lvAcc >= 80 ? '⭐' : '✅') : '🔄';
        html += `<div class="level-result-item">
            <div class="lri-header">
                <span class="lri-emoji">${emoji}</span>
                <span class="lri-name">레벨 ${lv}: ${LEVEL_NAMES[lv]}</span>
                <span class="lri-score" style="color:${barCol}">${lvAcc}%</span>
            </div>
            <div class="lri-bar-bg">
                <div class="lri-bar-fill" style="width:${lvAcc}%;background:${barCol}"></div>
            </div>
            <div style="font-size:0.8rem;color:var(--txt-dim);margin-top:4px">
                ✅ ${p.correct || 0}  ❌ ${p.wrong || 0}  ${p.completed ? '(완료)' : '(진행중)'}
            </div>
        </div>`;
    }
    detail.innerHTML = html;
}

function initNotesScreen() {
    if (!gameState.currentStudent) { showScreen('name'); return; }
    const studentData = getCurrentStudentData();
    if (!studentData) return;

    const notes     = studentData.wrongNotes || [];
    const container = document.getElementById('notes-content');
    const clearBtn  = document.getElementById('btn-clear-notes');

    if (notes.length === 0) {
        container.innerHTML = `<div class="notes-empty">
            🎉 오답노트가 비어있어요!<br>
            틀린 문제가 없다는 뜻이에요. 정말 잘하고 있어요!
        </div>`;
        clearBtn.style.display = 'none';
        return;
    }

    clearBtn.style.display = 'flex';

    // 레벨 순, 최신순 정렬
    const sorted = [...notes].sort((a, b) => a.level - b.level);

    container.innerHTML = sorted.map((note, idx) => {
        const fracHTML = renderFractionDisplay(note.display, true);
        return `<div class="note-item">
            <div class="note-level-tag">레벨 ${note.level} · ${note.levelName}</div>
            <div class="note-question">${renderTextWithFractions(note.question)}</div>
            ${fracHTML ? `<div class="note-fraction-preview">${fracHTML}</div>` : ''}
            <div class="note-answer-row">
                <span>내 답:</span>
                <span class="note-my-answer">❌ ${renderOptionText(note.options[note.myAnswer] || '?')}</span>
            </div>
            <div class="note-answer-row">
                <span>정답:</span>
                <span class="note-correct-answer">✅ ${renderOptionText(note.options[note.correct] || '?')}</span>
            </div>
            ${note.hint ? `<div class="note-hint">${renderTextWithFractions(note.hint)}</div>` : ''}
            <button class="btn btn-sm btn-primary note-retry-btn"
                    onclick="retryNoteQuestion(${idx})">
                🔄 다시 풀기
            </button>
        </div>`;
    }).join('');
}

async function initTeacherScreen() {
    const loginCard = document.getElementById('teacher-login-card');
    const content   = document.getElementById('teacher-content');

    if (isTeacherSessionValid()) {
        loginCard.style.display = 'none';
        content.style.display   = 'block';

        // 로딩 표시 (클라우드 데이터 수신 중)
        content.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--txt-dim);">
                <div class="spinner"></div>
                <p style="margin-top:16px;">학생 데이터를 불러오는 중…</p>
            </div>`;

        // 로컬 + 클라우드 병합 데이터로 대시보드 렌더링
        const merged = await getMergedStudentsData();
        content.innerHTML = renderTeacherDashboard(merged);
    } else {
        loginCard.style.display = 'block';
        content.style.display   = 'none';
        document.getElementById('teacher-pw-input').value = '';
        document.getElementById('teacher-pw-error').style.display = 'none';
    }
}

// ─────────────────────────────────────────────────────────
// HUD 업데이트
// ─────────────────────────────────────────────────────────

function updateHUD(studentData) {
    document.getElementById('hud-level-val').textContent   = Math.min(studentData.currentLevel  || 1, TOTAL_LEVELS);
    document.getElementById('hud-xp-val').textContent      = studentData.totalXP       || 0;
    document.getElementById('hud-correct-val').textContent = studentData.correctCount  || 0;
    document.getElementById('hud-wrong-val').textContent   = studentData.wrongCount    || 0;

    // XP 바
    const xpInLevel = (studentData.totalXP || 0) % XP_PER_LEVEL;
    const pct       = Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100);
    document.getElementById('xp-bar').style.width = pct + '%';
}

// ─────────────────────────────────────────────────────────
// 이름 입력 & 프로필 선택
// ─────────────────────────────────────────────────────────

function confirmName() {
    const input = document.getElementById('name-input');
    const name  = input.value.trim();
    if (!name) {
        input.focus();
        showToast('이름을 입력해주세요! 😊');
        return;
    }
    selectProfile(name);
}

async function selectProfile(name, quiet = false) {
    gameState.currentStudent = name;

    const data  = loadData();
    const isNew = !data.students[name];
    if (isNew) {
        data.students[name] = createDefaultStudentData();
    }
    // 마지막 로그인 학생을 localStorage에 기억
    data.currentStudent = name;
    saveData(data);

    if (!quiet) {
        showToast(isNew ? `${name}님, 환영해요! 🎉` : `다시 오셨군요, ${name}님! 👋`);
    }
    showScreen('map'); // 먼저 로컬 데이터로 즉시 표시

    // 백그라운드 클라우드 동기화 (비블로킹)
    // 다른 기기에서 더 진행됐으면 맵이 자동으로 갱신됨
    if (FIREBASE_URL) syncFromCloud(name);
}

function clearCurrentStudent() {
    // 남은 클라우드 저장 즉시 실행 후 초기화
    if (_cloudSaveTimer && gameState.currentStudent) {
        const data = loadData();
        flushCloudSave(gameState.currentStudent, data.students[gameState.currentStudent]);
    }
    gameState.currentStudent = '';
    const data = loadData();
    data.currentStudent = '';
    saveData(data);
}


// ─────────────────────────────────────────────────────────
// 레벨 맵
// ─────────────────────────────────────────────────────────

function renderLevelGrid(studentData) {
    const grid      = document.getElementById('level-grid');
    const curLevel  = studentData.currentLevel || 1;
    const isAllDone = curLevel > TOTAL_LEVELS;
    const lp        = studentData.levelProgress || {};

    let html = '';
    for (let lv = 1; lv <= TOTAL_LEVELS; lv++) {
        const isUnlocked  = isAllDone || lv <= curLevel;  // 전체 완료시 전부 해금
        const isCompleted = lp[lv] && lp[lv].completed;
        const isCurrent   = !isAllDone && lv === curLevel; // 전체 완료시 'current' 없음

        const p   = lp[lv] || { correct: 0, wrong: 0 };
        const tot = (p.correct || 0) + (p.wrong || 0);
        const acc = tot > 0 ? Math.round((p.correct / tot) * 100) : null;

        // 별 표시 (완료된 레벨만)
        let stars = '';
        if (isCompleted && acc !== null) {
            stars = acc >= 90 ? '★★★' : acc >= 70 ? '★★☆' : '★☆☆';
        }

        const classes = [
            'level-card',
            !isUnlocked ? 'locked' : '',
            isCompleted ? 'completed' : '',
            isCurrent   ? 'current' : ''
        ].filter(Boolean).join(' ');

        html += `<div class="${classes}" role="listitem"
                      ${isUnlocked ? `onclick="startLevel(${lv})"` : ''}
                      aria-label="레벨 ${lv} ${LEVEL_NAMES[lv]}${!isUnlocked ? ' (잠금)' : ''}">
            <div class="lc-number">레벨 ${lv}</div>
            <div class="lc-icon">${LEVEL_ICONS[lv]}</div>
            <div class="lc-name">${LEVEL_NAMES[lv]}</div>
            ${stars ? `<div class="lc-stars">${stars}</div>` : ''}
            ${acc !== null ? `<div class="lc-accuracy">${acc}%</div>` : ''}
            ${!isUnlocked ? `<div class="lc-lock">🔒</div>` : ''}
        </div>`;
    }
    grid.innerHTML = html;
}

// ─────────────────────────────────────────────────────────
// 레벨 시작 & 게임 로직
// ─────────────────────────────────────────────────────────

function confirmLeaveGame() {
    if (gameState.questionIndex > 0 || gameState.answered) {
        if (!confirm('게임을 중단하고 맵으로 돌아가시겠어요?\n이번 레벨 진행은 저장되지 않아요.')) return;
    }
    showScreen('map');
}

function startLevel(level) {
    gameState.currentLevel  = level;
    gameState.questionIndex = 0;
    gameState.correctCount  = 0;
    gameState.wrongCount    = 0;
    gameState.answered      = false;
    gameState.retryMode     = false;
    gameState.retryQuestion = null;

    // 문제 가져오기
    gameState.questions = getQuestions(level, QUESTIONS_PER_LEVEL);
    if (!gameState.questions || gameState.questions.length === 0) {
        showToast('문제를 불러올 수 없어요. 다시 시도해주세요.');
        return;
    }

    showScreen('game');
    renderQuestion();
}

function renderQuestion() {
    const q   = getCurrentQuestion();
    const idx = gameState.questionIndex;
    const tot = gameState.questions.length;

    if (!q) {
        finishLevel();
        return;
    }

    gameState.answered = false;

    // 진행 바
    const pct = (idx / tot) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent =
        `${idx + 1} / ${tot}${gameState.retryMode ? ' (다시 풀기)' : ''}`;
    document.getElementById('progress-level-tag').textContent =
        `레벨 ${gameState.currentLevel} · ${LEVEL_NAMES[gameState.currentLevel]}`;

    // 상단 레벨 라벨
    const gameLevelLabel = document.getElementById('game-level-label');
    if (gameLevelLabel) {
        gameLevelLabel.textContent = `레벨 ${gameState.currentLevel} · ${LEVEL_NAMES[gameState.currentLevel]}`;
    }

    // 레벨 태그
    document.getElementById('q-level-tag').textContent =
        `레벨 ${gameState.currentLevel} · ${LEVEL_NAMES[gameState.currentLevel]}`;

    // 문제 텍스트 (인라인 분수 변환 포함)
    document.getElementById('q-text').innerHTML = renderTextWithFractions(q.question);

    // 분수 시각화
    const fracArea = document.getElementById('q-fraction-display');
    const fracHTML = renderFractionDisplay(q.display, false);
    if (fracHTML) {
        fracArea.innerHTML = fracHTML;
        fracArea.style.display = 'flex';
    } else {
        fracArea.style.display = 'none';
    }

    // 선택지 초기화 (분수 형태면 시각적 분수로 렌더링)
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn, i) => {
        btn.innerHTML = renderOptionText(q.options[i] || '');
        btn.className = 'option-btn';
        btn.disabled  = false;
    });

    // 피드백 초기화 (innerHTML 지우면 하위 요소 삭제되므로 텍스트만 비움)
    const feedback = document.getElementById('feedback-area');
    feedback.className = 'feedback-area';
    const fTitle = document.getElementById('feedback-title');
    const fHint  = document.getElementById('feedback-hint');
    if (fTitle) fTitle.textContent = '';
    if (fHint)  fHint.textContent  = '';
    // 다음 버튼 숨기기
    const nextBtn = document.getElementById('btn-next');
    nextBtn.className = 'btn btn-lg btn-primary';
    nextBtn.style.display = 'none';

    // 카드 입장 애니메이션
    const card = document.getElementById('question-card');
    card.style.transform = 'translateX(30px)';
    card.style.opacity   = '0';
    requestAnimationFrame(() => {
        card.style.transition = 'transform 0.35s var(--ease-bounce), opacity 0.3s';
        card.style.transform  = 'translateX(0)';
        card.style.opacity    = '1';
    });
}

function getCurrentQuestion() {
    if (gameState.retryMode && gameState.retryQuestion) {
        return gameState.retryQuestion;
    }
    return gameState.questions[gameState.questionIndex];
}

function selectOption(idx) {
    if (gameState.answered) return;
    gameState.answered = true;

    const q    = getCurrentQuestion();
    const btns = document.querySelectorAll('.option-btn');
    const isCorrect = (idx === q.correct);

    // 모든 버튼 비활성화
    btns.forEach(btn => { btn.disabled = true; });

    // 정답/오답 표시
    btns[idx].classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) {
        btns[q.correct].classList.add('reveal');
    }

    if (isCorrect) {
        handleCorrectAnswer(q);
    } else {
        handleWrongAnswer(q, idx);
    }

    // 다음 버튼 표시
    const nBtn = document.getElementById('btn-next');
    nBtn.classList.add('visible');
    nBtn.style.display = 'flex';
}

function handleCorrectAnswer(q) {
    // 정답 피드백
    const feedback  = document.getElementById('feedback-area');
    const feedTitle = document.getElementById('feedback-title');
    const feedHint  = document.getElementById('feedback-hint');

    const correctMsgs = ['🎉 정답이에요!', '⭐ 훌륭해요!', '✨ 맞았어요!', '👏 완벽해요!'];
    feedTitle.textContent = correctMsgs[Math.floor(Math.random() * correctMsgs.length)];
    feedHint.innerHTML = '';
    feedback.className    = 'feedback-area correct-feedback visible';

    // 효과음
    playSound('correct');

    // XP 더하기
    const studentData = getCurrentStudentData();
    if (studentData) {
        studentData.totalXP    = (studentData.totalXP    || 0) + XP_PER_CORRECT;
        studentData.correctCount = (studentData.correctCount || 0) + 1;
        updateCurrentStudentData(studentData);
        updateHUD(studentData);
    }

    // 레벨 정답 카운터
    gameState.correctCount++;

    // 재출제 모드 완료
    if (gameState.retryMode) {
        gameState.retryMode     = false;
        gameState.retryQuestion = null;
    }

    // +XP 파티클
    showXpFloat(XP_PER_CORRECT);
}

function handleWrongAnswer(q, myAnswerIdx) {
    // 오답 피드백
    const feedback  = document.getElementById('feedback-area');
    const feedTitle = document.getElementById('feedback-title');
    const feedHint  = document.getElementById('feedback-hint');

    feedTitle.textContent  = '😅 틀렸어요. 다음에 잘 해봐요!';
    feedHint.innerHTML     = renderTextWithFractions(q.hint || '');
    feedback.className    = 'feedback-area wrong-feedback visible';

    // 효과음
    playSound('wrong');

    // 오답 카운터
    gameState.wrongCount++;

    // 오답노트 저장
    addToWrongNotes(q, myAnswerIdx, q.options[q.correct]);

    const studentData = getCurrentStudentData();
    if (studentData) {
        studentData.wrongCount = (studentData.wrongCount || 0) + 1;
        updateCurrentStudentData(studentData);
        updateHUD(studentData);
    }

    // 재출제 준비 (첫 오답만)
    if (!gameState.retryMode) {
        const similar = getSimilarQuestion(gameState.currentLevel, gameState.questions);
        if (similar) {
            gameState.retryQuestion = similar;
        }
    } else {
        // 재출제 오답 → 패스
        gameState.retryMode     = false;
        gameState.retryQuestion = null;
    }
}

function nextQuestion() {
    // 재출제 모드로 전환?
    if (!gameState.retryMode && gameState.retryQuestion) {
        gameState.retryMode = true;
        renderQuestion();
        return;
    }

    gameState.questionIndex++;
    gameState.retryMode     = false;
    gameState.retryQuestion = null;

    if (gameState.questionIndex >= gameState.questions.length) {
        finishLevel();
    } else {
        renderQuestion();
    }
}

// ─────────────────────────────────────────────────────────
// 레벨 완료
// ─────────────────────────────────────────────────────────

function finishLevel() {
    const level    = gameState.currentLevel;
    const correct  = gameState.correctCount;
    const wrong    = gameState.wrongCount;
    const total    = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const isAllCorrect = (correct === QUESTIONS_PER_LEVEL && wrong === 0);

    // 레벨 보너스 XP
    let bonusXP = isAllCorrect ? XP_PER_LEVEL_BONUS : Math.floor((accuracy / 100) * 50);
    bonusXP = Math.max(0, bonusXP);

    const studentData = getCurrentStudentData();
    if (!studentData) { showScreen('map'); return; }

    // 레벨 진행 기록
    if (!studentData.levelProgress) studentData.levelProgress = {};
    const prevProgress = studentData.levelProgress[level] || {};
    studentData.levelProgress[level] = {
        completed: true,
        correct:   (prevProgress.correct || 0) + correct,
        wrong:     (prevProgress.wrong   || 0) + wrong
    };

    // XP 추가
    studentData.totalXP = (studentData.totalXP || 0) + bonusXP;

    // 레벨 업 체크
    const prevLevel = studentData.currentLevel || 1;
    let leveledUp   = false;
    let newCharacter = false;

    if (accuracy >= 70 && level >= prevLevel) {
        if (level < TOTAL_LEVELS) {
            // 중간 레벨 통과 → 다음 레벨 해금
            studentData.currentLevel = level + 1;
            leveledUp = true;
            const prevChar = getCharacterInfo(prevLevel);
            const newChar  = getCharacterInfo(level + 1);
            newCharacter = (prevChar.name !== newChar.name);
        } else {
            // 마지막 레벨(11) 통과 → 전체 완료 마킹
            studentData.currentLevel = TOTAL_LEVELS + 1;
        }
    }

    studentData.maxLevel = Math.max(studentData.maxLevel || 1, studentData.currentLevel);
    updateCurrentStudentData(studentData, true); // 레벨 완료 → 즉시 클라우드 저장

    // 결과 화면 렌더링
    showResultScreen(level, correct, total, accuracy, bonusXP, leveledUp, newCharacter, studentData);
}

function showResultScreen(level, correct, total, accuracy, bonusXP, leveledUp, newCharacter, studentData) {
    const feedback = getLevelCompleteFeedback(level, correct, total);

    document.getElementById('result-emoji').textContent    = feedback.emoji;
    document.getElementById('result-title').textContent    = feedback.title;
    document.getElementById('result-title').className      =
        `result-title ${accuracy >= 90 ? 'great' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'ok' : 'retry'}`;
    document.getElementById('result-score').innerHTML      =
        `${total}문제 중 <strong>${correct}</strong>문제 정답!`;
    document.getElementById('result-xp').textContent       =
        `+${bonusXP} XP 획득! ⚡`;

    // 정확도 바
    const barFill = document.getElementById('result-acc-bar');
    barFill.style.width      = '0%';
    barFill.style.background = accuracy >= 80 ? 'var(--clr-green)'
                             : accuracy >= 60 ? 'var(--clr-orange)'
                             : 'var(--clr-red)';
    setTimeout(() => { barFill.style.width = accuracy + '%'; }, 100);
    document.getElementById('result-acc-label').textContent = `정답률 ${accuracy}%`;

    // 별 표시
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`star-${i}`);
        el.classList.remove('lit');
        if (i <= stars) {
            setTimeout(() => {
                el.classList.add('lit');
                playSound('star');
            }, 300 + (i - 1) * 200);
        }
    }

    // 진단 메시지
    const diagEl = document.getElementById('result-diagnosis');
    if (feedback.weaknessMessages.length > 0) {
        diagEl.innerHTML = `<div style="margin-top:8px;color:var(--txt-dim);font-size:0.9rem">
            💡 ${feedback.weaknessMessages[0]}
        </div>`;
    } else {
        diagEl.innerHTML = '';
    }

    // 다음 레벨 버튼
    const nextBtn = document.getElementById('btn-result-next');
    const studentNextLevel = studentData.currentLevel || 1;
    if (gameState.currentLevel < TOTAL_LEVELS && studentNextLevel > level) {
        // 중간 레벨 통과 → 다음 레벨 버튼
        nextBtn.style.display = 'flex';
        nextBtn.textContent   = `레벨 ${level + 1} 도전! 🚀`;
    } else if (gameState.currentLevel >= TOTAL_LEVELS && studentNextLevel > TOTAL_LEVELS) {
        // 마지막 레벨(11) 통과 → 전체 완료 버튼 (맵으로 이동)
        nextBtn.style.display = 'flex';
        nextBtn.textContent   = '🏆 완료! 맵으로 돌아가기';
    } else {
        // 정확도 부족(재도전 필요) → 다음 버튼 없음
        nextBtn.style.display = 'none';
    }

    showScreen('result');

    // 레벨업 오버레이
    if (leveledUp) {
        setTimeout(() => showLevelUp(level + 1, newCharacter), 600);
    }

    // 효과음
    playSound(accuracy >= 70 ? 'levelComplete' : 'tryAgain');

    // 파티클
    if (accuracy >= 70) {
        setTimeout(() => spawnParticles(), 300);
    }
}

function goToNextLevel() {
    const studentData = getCurrentStudentData();
    if (!studentData) return;
    // 전체 완료 상태 (currentLevel이 11을 초과)
    if ((studentData.currentLevel || 1) > TOTAL_LEVELS) {
        showScreen('map');
        setTimeout(() => {
            showToast('🏆 모든 레벨을 완료했어요! 분수 마스터!');
            spawnParticles();
        }, 400);
        return;
    }
    startLevel(studentData.currentLevel || 1);
}

function retryCurrentLevel() {
    startLevel(gameState.currentLevel);
}

// ─────────────────────────────────────────────────────────
// 레벨업 오버레이
// ─────────────────────────────────────────────────────────

function showLevelUp(newLevel, newCharacter) {
    const char = getCharacterInfo(newLevel);
    document.getElementById('lu-icon').textContent = char.icon;
    const sub = newCharacter
        ? `${char.name}(으)로 진화했어요! 🌟`
        : `레벨 ${newLevel}에 도달했어요! 🎉`;
    document.getElementById('lu-sub').textContent = sub;
    document.getElementById('levelup-overlay').classList.add('visible');
    playSound('levelUp');
    spawnParticles();
}

function closeLevelUp() {
    document.getElementById('levelup-overlay').classList.remove('visible');
}

// ─────────────────────────────────────────────────────────
// 텍스트 인라인 분수 변환 (질문·힌트·오답노트용)
// ─────────────────────────────────────────────────────────

/**
 * 일반 텍스트 안의 "N/D" 패턴을 인라인 시각 분수로 바꿉니다.
 * 개행(\n)은 <br>로 변환합니다.
 * XSS 방지를 위해 분수 외 부분은 모두 HTML 이스케이프합니다.
 *
 * 예) "1/3과 1/4를 통분하면?"
 *   → [FRAC(1/3)]과 [FRAC(1/4)]를 통분하면?
 *
 * 예) "1×2 / 2×2 = 2/4"  (공백 있는 '/'는 건너뜀)
 *   → 1×2 / 2×2 = [FRAC(2/4)]
 *
 * @param {string} text
 * @returns {string} HTML 문자열
 */
function renderTextWithFractions(text) {
    if (!text) return '';
    // /(\d+\/\d+)/ 의 캡처 그룹으로 split하면
    // 짝수 인덱스 = 일반 텍스트, 홀수 인덱스 = 분수
    return text.split(/(\d+\/\d+)/).map((part, i) => {
        if (i % 2 === 1) {
            // 분수 부분
            const [num, den] = part.split('/');
            return makeInlineFracHTML(num, den);
        }
        // 일반 텍스트: HTML 이스케이프 + 줄바꿈 처리
        return escapeHTML(part).replace(/\n/g, '<br>');
    }).join('');
}

/**
 * 텍스트 안에 인라인으로 들어가는 작은 시각 분수 HTML을 만듭니다.
 * 선택지용(opt-frac)보다 작고 텍스트 높이에 맞게 정렬됩니다.
 */
function makeInlineFracHTML(num, den) {
    return `<span class="txt-frac"><span class="txt-frac-num">${num}</span><span class="txt-frac-line"></span><span class="txt-frac-den">${den}</span></span>`;
}

// ─────────────────────────────────────────────────────────
// 선택지 텍스트 렌더링 (분수 시각화)
// ─────────────────────────────────────────────────────────

/**
 * 선택지 문자열을 HTML로 변환합니다.
 *
 * 처리 패턴:
 *   "3/4"          → 시각적 분수
 *   "5/3만"         → 시각적 분수 + 접미사
 *   "4/12와 3/12"  → 분수 쌍 (레벨 8 통분 정답 등)
 *   "5/3과 9/9"    → 분수 쌍
 *   "1/3 + 1/4"   → 수식 형태
 *   "1 2/3"        → 대분수
 *   그 외           → 일반 텍스트 (XSS 이스케이프)
 *
 * @param {string} str
 * @returns {string} HTML
 */
function renderOptionText(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();

    // ① 순수 분수: "3/4", "12/15"
    if (/^\d+\/\d+$/.test(s)) {
        const [n, d] = s.split('/');
        return makeOptFracHTML(n, d);
    }

    // ② 분수 + 한국어 접미사: "5/3만", "9/9만"
    const fracSuffix = /^(\d+)\/(\d+)(만|도|은|는)$/.exec(s);
    if (fracSuffix) {
        return makeOptFracHTML(fracSuffix[1], fracSuffix[2]) +
               `<span class="opt-text">${fracSuffix[3]}</span>`;
    }

    // ③ 두 분수 + 와/과: "4/12와 3/12", "5/3과 9/9"
    const twoFracKo = /^(\d+\/\d+)\s*(와|과)\s*(\d+\/\d+)$/.exec(s);
    if (twoFracKo) {
        return `<span class="opt-pair">` +
            renderSingleFrac(twoFracKo[1]) +
            `<span class="opt-sep">${twoFracKo[2]}</span>` +
            renderSingleFrac(twoFracKo[3]) +
            `</span>`;
    }

    // ④ 두 분수 + 산술 연산자: "1/3 + 1/4", "3/4 - 1/6"
    const twoFracOp = /^(\d+\/\d+)\s*([+\-])\s*(\d+\/\d+)$/.exec(s);
    if (twoFracOp) {
        return `<span class="opt-pair">` +
            renderSingleFrac(twoFracOp[1]) +
            `<span class="opt-sep">${twoFracOp[2]}</span>` +
            renderSingleFrac(twoFracOp[3]) +
            `</span>`;
    }

    // ⑤ 대분수: "1 2/3"
    const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
    if (mixed) {
        return `<span class="opt-mixed">` +
            `<span class="opt-whole">${mixed[1]}</span>` +
            makeOptFracHTML(mixed[2], mixed[3]) +
            `</span>`;
    }

    // ⑥ 일반 텍스트
    return escapeHTML(s);
}

/** 단일 "N/D" 문자열 → 시각 분수 HTML (내부 헬퍼) */
function renderSingleFrac(str) {
    const m = /^(\d+)\/(\d+)$/.exec(str.trim());
    return m ? makeOptFracHTML(m[1], m[2]) : escapeHTML(str);
}

/**
 * 분자/분모를 시각적 분수 HTML로 만듭니다 (선택지용).
 */
function makeOptFracHTML(num, den) {
    return `<span class="opt-frac"><span class="opt-frac-num">${num}</span><span class="opt-frac-line"></span><span class="opt-frac-den">${den}</span></span>`;
}



/**
 * display 객체를 HTML로 변환합니다.
 * @param {object} display - 문제의 display 객체
 * @param {boolean} small  - 오답노트용 작은 크기
 * @returns {string} HTML 문자열
 */
function renderFractionDisplay(display, small) {
    if (!display || display.type === 'text') return '';

    const scale = small ? 'font-size:1.2rem' : '';

    switch (display.type) {
        case 'single':
            return `<div class="fraction" style="${scale}">
                <span class="fraction-num">${display.num}</span>
                <div class="fraction-line"></div>
                <span class="fraction-den">${display.den}</span>
            </div>`;

        case 'compare': {
            const f1 = makeFracHTML(display.frac1, scale);
            const f2 = makeFracHTML(display.frac2, scale);
            return `${f1}
                <span class="compare-symbol" style="${scale}">?</span>
                ${f2}`;
        }

        case 'pair': {
            const f1 = makeFracHTML(display.frac1, scale);
            const f2 = makeFracHTML(display.frac2, scale);
            return `${f1}
                <span class="fraction-op" style="${scale}">,</span>
                ${f2}`;
        }

        case 'multi': {
            return display.fracs.map((f, i) =>
                (i > 0 ? '<span class="fraction-op">,</span>' : '') + makeFracHTML(f, scale)
            ).join('');
        }

        case 'calc': {
            return `<div class="calc-expr" style="${scale}">${escapeHTML(display.expr)}</div>`;
        }

        default:
            return '';
    }
}

/** 분수 객체를 HTML로 변환하는 헬퍼 */
function makeFracHTML(frac, styleStr) {
    return `<div class="fraction" style="${styleStr}">
        <span class="fraction-num">${frac.num}</span>
        <div class="fraction-line"></div>
        <span class="fraction-den">${frac.den}</span>
    </div>`;
}

// ─────────────────────────────────────────────────────────
// 오답노트
// ─────────────────────────────────────────────────────────

function retryNoteQuestion(noteIndex) {
    const studentData = getCurrentStudentData();
    if (!studentData) return;

    const notes = studentData.wrongNotes || [];
    const note  = notes[noteIndex];
    if (!note) return;

    // 문제 형식으로 변환
    const question = {
        question: note.question,
        display:  note.display,
        options:  note.options,
        correct:  note.correct,
        hint:     note.hint
    };

    // 레벨 설정 후 단일 문제 게임 시작
    gameState.currentLevel  = note.level;
    gameState.questionIndex = 0;
    gameState.correctCount  = 0;
    gameState.wrongCount    = 0;
    gameState.answered      = false;
    gameState.retryMode     = false;
    gameState.retryQuestion = null;
    gameState.questions     = [question];

    showScreen('game');
    renderQuestion();
}

function clearWrongNotes() {
    if (!confirm('오답노트를 모두 지우시겠어요?\n지운 내용은 복구할 수 없어요.')) return;
    updateCurrentStudentData({ wrongNotes: [] });
    initNotesScreen();
    showToast('오답노트를 비웠어요! 🧹');
}

// ─────────────────────────────────────────────────────────
// 교사 로그인
// ─────────────────────────────────────────────────────────

function teacherLogin() {
    const pw    = document.getElementById('teacher-pw-input').value;
    const error = document.getElementById('teacher-pw-error');

    if (verifyTeacherPassword(pw)) {
        startTeacherSession();
        error.style.display = 'none';
        initTeacherScreen();
    } else {
        error.style.display = 'block';
        document.getElementById('teacher-pw-input').value = '';
        document.getElementById('teacher-pw-input').focus();
        playSound('wrong');
    }
}

// ─────────────────────────────────────────────────────────
// 네비게이션 헬퍼
// ─────────────────────────────────────────────────────────

function showDiagnosisFromMain() {
    if (!gameState.currentStudent) {
        showScreen('name');
        gameState.fromScreen = 'diagnosis';
    } else {
        gameState.fromScreen = 'main';
        showScreen('diagnosis');
    }
}

function showRecordsFromMain() {
    if (!gameState.currentStudent) {
        showScreen('name');
        gameState.fromScreen = 'records';
    } else {
        gameState.fromScreen = 'main';
        showScreen('records');
    }
}

function goBackFromDiagnosis() {
    showScreen(gameState.fromScreen || 'map');
}

function goBackFromNotes() {
    showScreen(gameState.fromScreen || 'map');
}

// ─────────────────────────────────────────────────────────
// 캐릭터 정보
// ─────────────────────────────────────────────────────────

function getCharacterInfo(level) {
    const lv = Math.max(1, Math.min(TOTAL_LEVELS, level || 1));
    return CHARACTERS.find(c => lv >= c.minLevel && lv <= c.maxLevel) || CHARACTERS[0];
}

// ─────────────────────────────────────────────────────────
// 효과음 (Web Audio API)
// ─────────────────────────────────────────────────────────

function getAudioCtx() {
    if (!gameState.audioCtx) {
        try {
            gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return null;
        }
    }
    // iOS: resume 필요
    if (gameState.audioCtx.state === 'suspended') {
        gameState.audioCtx.resume();
    }
    return gameState.audioCtx;
}

function playSound(type) {
    const ctx = getAudioCtx();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
            case 'correct':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.linearRampToValueAtTime(660, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            case 'wrong':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(150, now + 0.15);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
                break;

            case 'levelComplete': {
                const notes = [523, 659, 784, 1047];
                notes.forEach((freq, i) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.type = 'sine';
                    o.frequency.setValueAtTime(freq, now + i * 0.12);
                    g.gain.setValueAtTime(0.25, now + i * 0.12);
                    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
                    o.start(now + i * 0.12);
                    o.stop(now + i * 0.12 + 0.2);
                });
                return;
            }

            case 'levelUp': {
                const melody = [523, 659, 784, 1047, 1319];
                melody.forEach((freq, i) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.type = 'sine';
                    o.frequency.setValueAtTime(freq, now + i * 0.1);
                    g.gain.setValueAtTime(0.3, now + i * 0.1);
                    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
                    o.start(now + i * 0.1);
                    o.stop(now + i * 0.1 + 0.25);
                });
                return;
            }

            case 'star':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'tryAgain':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.linearRampToValueAtTime(220, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
                break;

            default:
                return;
        }
    } catch (e) {
        // 효과음 오류는 무시
    }
}

// ─────────────────────────────────────────────────────────
// 파티클 & 애니메이션
// ─────────────────────────────────────────────────────────

function spawnParticles() {
    const emojis = ['⭐', '✨', '🎉', '🌟', '💫', '🎊', '⚡'];
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const el      = document.createElement('div');
            el.className  = 'particle';
            el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            el.style.left = Math.random() * 100 + 'vw';
            el.style.top  = (60 + Math.random() * 30) + 'vh';
            el.style.setProperty('--delay', i * 0.08 + 's');
            el.style.animationDuration = (1 + Math.random() * 0.8) + 's';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 2000);
        }, i * 80);
    }
}

/** +XP 플로팅 텍스트 */
function showXpFloat(amount) {
    const el      = document.createElement('div');
    el.className  = 'particle';
    el.textContent = `+${amount} XP ⚡`;
    el.style.cssText = `
        position:fixed;
        left:50%;transform:translateX(-50%);
        top:70vh;
        color:var(--clr-gold);
        font-weight:900;
        font-size:1.4rem;
        z-index:250;
        pointer-events:none;
        animation:particleFly 1s ease-out forwards;
        font-family:var(--font-main);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

// ─────────────────────────────────────────────────────────
// 토스트 알림
// ─────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─────────────────────────────────────────────────────────
// 별 배경 생성
// ─────────────────────────────────────────────────────────

function initStarBackground() {
    const bg    = document.getElementById('star-bg');
    const count = 80;
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star-dot';
        const size  = Math.random() * 2.5 + 0.5;
        const dur   = (Math.random() * 4 + 2).toFixed(1);
        const maxOp = (Math.random() * 0.5 + 0.2).toFixed(2);
        star.style.cssText = `
            left:${Math.random()*100}%;
            top:${Math.random()*100}%;
            width:${size}px;height:${size}px;
            --dur:${dur}s;
            --max-op:${maxOp};
            animation-delay:${(Math.random()*dur).toFixed(1)}s;
        `;
        bg.appendChild(star);
    }
}

// ─────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────

function escapeHTML(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────
// 키보드 단축키
// ─────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    const gameScreen = document.getElementById('screen-game');
    if (!gameScreen.classList.contains('active')) return;

    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (keyMap[e.key] !== undefined && !gameState.answered) {
        selectOption(keyMap[e.key]);
    }
    if ((e.key === 'Enter' || e.key === ' ') && gameState.answered) {
        const btn = document.getElementById('btn-next');
        if (btn.classList.contains('visible')) nextQuestion();
    }
});

// ─────────────────────────────────────────────────────────
// 이름 입력 엔터 키
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const nameInput = document.getElementById('name-input');
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmName();
        });
    }

    // 별 배경
    initStarBackground();

    // 오디오 컨텍스트 초기화 (첫 클릭 시)
    document.body.addEventListener('click', () => {
        getAudioCtx();
    }, { once: true });

    // 페이지 닫힐 때 대기 중인 클라우드 저장 즉시 실행
    window.addEventListener('beforeunload', () => {
        if (_cloudSaveTimer && gameState.currentStudent) {
            const data = loadData();
            flushCloudSave(gameState.currentStudent, data.students[gameState.currentStudent]);
        }
    });

    // 마지막 로그인 학생 자동 복원
    // 이전에 플레이하다 닫았으면 이름 입력 없이 바로 맵으로 이동
    // FIREBASE_URL 설정 시 클라우드에서 최신 기록도 백그라운드 동기화
    const data = loadData();
    if (data.currentStudent && data.students[data.currentStudent]) {
        await selectProfile(data.currentStudent, true); // quiet=true (토스트 없이 조용히 복원)
    }
});
