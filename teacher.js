/**
 * teacher.js - 분수 마스터 교사용 대시보드
 * =====================================================
 * 교사가 학생들의 학습 현황을 확인하고 관리할 수 있는
 * 대시보드 기능을 제공합니다.
 *
 * 비밀번호: 3699
 */

'use strict';

// ─────────────────────────────────────────────────────────
// 교사 대시보드 설정
// ─────────────────────────────────────────────────────────

const TEACHER_CONFIG = {
    PASSWORD: '3699',
    MAX_LOGIN_ATTEMPTS: 5,
    SESSION_KEY: 'fm_teacher_session'
};

// ─────────────────────────────────────────────────────────
// 교사 인증
// ─────────────────────────────────────────────────────────

/**
 * 비밀번호 검증
 * @param {string} inputPassword
 * @returns {boolean}
 */
function verifyTeacherPassword(inputPassword) {
    return inputPassword === TEACHER_CONFIG.PASSWORD;
}

/**
 * 교사 세션 시작
 */
function startTeacherSession() {
    sessionStorage.setItem(TEACHER_CONFIG.SESSION_KEY, 'true');
}

/**
 * 교사 세션 종료
 */
function endTeacherSession() {
    sessionStorage.removeItem(TEACHER_CONFIG.SESSION_KEY);
}

/**
 * 교사 세션 유효 여부 확인
 * @returns {boolean}
 */
function isTeacherSessionValid() {
    return sessionStorage.getItem(TEACHER_CONFIG.SESSION_KEY) === 'true';
}

// ─────────────────────────────────────────────────────────
// 학생 데이터 수집
// ─────────────────────────────────────────────────────────

/**
 * LocalStorage에서 모든 학생 데이터를 가져옵니다.
 * @returns {object} { studentName: studentData, ... }
 */
function getAllStudentsData() {
    try {
        const raw = localStorage.getItem('fractionMaster');
        if (!raw) return {};
        const data = JSON.parse(raw);
        return data.students || {};
    } catch (e) {
        console.error('학생 데이터 로드 오류:', e);
        return {};
    }
}

// ─────────────────────────────────────────────────────────
// 클라우드 학생 데이터 수집 (Firebase 연동)
// ─────────────────────────────────────────────────────────

/** 마지막으로 로드한 병합 학생 데이터 캐시 (CSV 다운로드 등에서 재사용) */
let _lastTeacherData = null;

/**
 * Firebase에서 모든 학생 데이터를 불러옵니다.
 * FIREBASE_URL이 설정되지 않았거나 오프라인이면 {} 반환.
 * @returns {Promise<object>} { studentName: studentData, ... }
 */
async function getAllStudentsFromCloud() {
    const fbUrl = (typeof FIREBASE_URL !== 'undefined') ? FIREBASE_URL : '';
    if (!fbUrl) return null; // Firebase 미설정 → null (로컬 사용 신호)
    try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 5000);
        const res  = await fetch(`${fbUrl}/fractionMaster.json`, { signal: ctrl.signal });
        if (!res.ok) { clearTimeout(tid); return null; } // 오류 → null
        const raw = await res.json();
        clearTimeout(tid);
        if (raw === null) return {};  // Firebase 연결 성공, 학생 없음 → 빈 객체
        if (!raw || typeof raw !== 'object') return null;

        const decoded = {};
        Object.entries(raw).forEach(([key, val]) => {
            if (!val || typeof val !== 'object') return;
            try { decoded[decodeURIComponent(key)] = val; }
            catch { decoded[key] = val; }
        });
        return decoded; // 정상 데이터 반환
    } catch (e) {
        return null; // 오프라인 / 타임아웃 → null (로컬 폴백 신호)
    }
}

/**
 * 교사 대시보드용 학생 데이터 병합.
 *
 * Firebase 응답 있을 때 → Firebase가 정답 목록 (삭제된 학생 복원 안 됨)
 * Firebase 응답 없을 때 → 로컬 데이터 폴백 (오프라인 대응)
 */
async function getMergedStudentsData() {
    const local = getAllStudentsData();

    // 4초 하드 타임아웃 (무한 로딩 방지)
    let cloud;
    try {
        const fallback = new Promise(resolve => setTimeout(() => resolve(null), 4000));
        cloud = await Promise.race([getAllStudentsFromCloud(), fallback]);
    } catch (e) {
        cloud = null;
    }

    // cloud = null  → Firebase 미설정 or 오프라인 → 로컬만 사용
    // cloud = {}    → Firebase 정상, 학생 없음  → 빈 목록
    // cloud = {...} → Firebase 정상, 학생 있음  → 클라우드 기준 병합
    if (cloud === null) {
        _lastTeacherData = local;
        return local;
    }

    // Firebase를 기준 목록으로 사용
    // → Firebase에 없는 학생은 삭제된 것으로 간주 (로컬에 있어도 표시 안 함)
    const merged = {};
    Object.entries(cloud).forEach(([name, cloudData]) => {
        const localData = local[name];
        // 로컬이 더 진행됐으면 로컬 우선, 아니면 클라우드
        if (localData && (localData.totalXP || 0) > (cloudData.totalXP || 0)) {
            merged[name] = localData;
        } else {
            merged[name] = cloudData;
        }
    });

    _lastTeacherData = merged;
    return merged;
}



/**
 * 학생 요약 통계를 계산합니다.
 * @param {string} name - 학생 이름
 * @param {object} data - 학생 데이터
 * @returns {object} 요약 통계
 */
function calcStudentSummary(name, data) {
    if (!data) data = {};
    const levelProgress = data.levelProgress || {};
    const wrongNotes    = data.wrongNotes    || [];
    // null 값 방어: Firebase에서 null 항목이 올 수 있음
    const completedLevels = Object.values(levelProgress).filter(p => p && p.completed).length;
    const totalCorrect    = data.correctCount || 0;
    const totalWrong      = data.wrongCount   || 0;
    const totalAnswered   = totalCorrect + totalWrong;
    const accuracy        = totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    // 취약 레벨 찾기 — 가장 최근 도전 결과 기준 (없으면 누적값으로 폴백)
    // 학생이 해당 레벨을 다시 풀어 정답률이 오르면 취약 표시가 사라진다.
    const weakLevels = [];
    Object.entries(levelProgress).forEach(([lvl, p]) => {
        if (!p) return;
        const hasRecent = (p.recentCorrect != null) && (p.recentWrong != null);
        const c = hasRecent ? p.recentCorrect : (p.correct || 0);
        const w = hasRecent ? p.recentWrong   : (p.wrong   || 0);
        const total = c + w;
        if (total >= 5 && c / total < 0.6) {
            weakLevels.push(parseInt(lvl));
        }
    });

    // 캐릭터 이름
    const characterName = getCharacterName(data.currentLevel || 1);

    return {
        name,
        currentLevel: data.currentLevel || 1,
        maxLevel: data.maxLevel || 1,
        totalXP: data.totalXP || 0,
        completedLevels,
        totalCorrect,
        totalWrong,
        totalAnswered,
        accuracy,
        wrongNotesCount: wrongNotes.length,
        weakLevels,
        characterName,
        lastPlayed: data.lastPlayed || '기록 없음',
        lastLogin:  data.lastLogin  || null,
        goldenFound:   data.goldenFound || 0,
        goldenGiven:   data.goldenGiven || 0,
        goldenPending: Math.max(0, (data.goldenFound || 0) - (data.goldenGiven || 0))
    };
}

/**
 * 마지막 로그인 시각(ISO 문자열)을 한국식 날짜+시간으로 표시합니다.
 * 오늘이면 '오늘 오후 2:30', 어제면 '어제 …', 그 외엔 'M월 D일 …' 형식.
 */
function formatLastLogin(iso) {
    if (!iso) return '기록 없음';
    const d = new Date(iso);
    if (isNaN(d)) return '기록 없음';
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const now  = new Date();
    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay(d, now))       return `오늘 ${time}`;
    if (sameDay(d, yesterday)) return `어제 ${time}`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

/**
 * 캐릭터 단계 이름을 반환합니다.
 */
function getCharacterName(level) {
    if (level <= 2)  return '분수 새싹 🌱';
    if (level <= 4)  return '분수 모험가 ⚔️';
    if (level <= 7)  return '분수 기사 🛡️';
    if (level <= 9)  return '분수 마법사 🔮';
    return '분수 마스터 👑';
}

// ─────────────────────────────────────────────────────────
// 대시보드 렌더링
// ─────────────────────────────────────────────────────────

/**
 * 전체 교사 대시보드 HTML을 렌더링합니다.
 * @param {object} studentsRaw - getMergedStudentsData()로 가져온 학생 데이터
 *                               (생략하면 로컬 데이터만 사용)
 * @returns {string} HTML 문자열
 */
function renderTeacherDashboard(studentsRaw) {
    if (!studentsRaw) studentsRaw = getAllStudentsData();
    const students = Object.entries(studentsRaw).map(
        ([name, data]) => calcStudentSummary(name, data)
    );

    if (students.length === 0) {
        return `<div class="teacher-empty">
            <div class="empty-icon">📋</div>
            <p>아직 학생 데이터가 없습니다.</p>
            <p>학생들이 게임을 시작하면 여기에 기록이 표시됩니다.</p>
        </div>`;
    }

    // 요약 통계
    const avgAccuracy = students.length > 0
        ? Math.round(students.reduce((s, st) => s + st.accuracy, 0) / students.length)
        : 0;
    const avgLevel = students.length > 0
        ? (students.reduce((s, st) => s + st.currentLevel, 0) / students.length).toFixed(1)
        : 0;
    const totalWrongNotes = students.reduce((s, st) => s + st.wrongNotesCount, 0);
    const pendingCount = students.filter(st => st.goldenPending > 0).length;
    _lastTeacherData = studentsRaw;

    let html = `
    <div class="teacher-dashboard">
        <div class="teacher-tabs">
            <button class="tt-btn active" id="tt-students" onclick="teacherTab('students')">👥 학생 현황 ${students.length}</button>
            <button class="tt-btn" id="tt-gifts" onclick="teacherTab('gifts')">🎁 황금 선물${pendingCount > 0 ? ` · 대기 ${pendingCount}` : ''}</button>
        </div>
        <div id="tab-students" class="teacher-tab-pane">
        <!-- 요약 카드들 -->
        <div class="teacher-summary-cards">
            <div class="summary-card">
                <div class="sc-value">${students.length}</div>
                <div class="sc-label">학생 수</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${avgAccuracy}%</div>
                <div class="sc-label">평균 정답률</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${avgLevel}</div>
                <div class="sc-label">평균 레벨</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${totalWrongNotes}</div>
                <div class="sc-label">총 오답 수</div>
            </div>
        </div>

        <!-- 학생 테이블 -->
        <div class="teacher-table-wrap">
            <table class="teacher-table">
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>현재 레벨</th>
                        <th>캐릭터</th>
                        <th>정답률</th>
                        <th>맞힌 수</th>
                        <th>틀린 수</th>
                        <th>경험치</th>
                        <th>오답노트</th>
                        <th>취약 레벨</th>
                        <th>황금 분수</th>
                        <th>마지막 접속</th>
                    </tr>
                </thead>
                <tbody>
    `;

    students
        .sort((a, b) => b.currentLevel - a.currentLevel || b.accuracy - a.accuracy)
        .forEach(st => {
            const accColor = st.accuracy >= 80 ? '#4CAF50'
                           : st.accuracy >= 60 ? '#FF9800'
                           : '#F44336';
            const weakStr = st.weakLevels.length > 0
                ? st.weakLevels.map(l => `Lv.${l}`).join(', ')
                : '없음';
            const safeName = escapeHTML(st.name).replace(/'/g, '&#39;');
            html += `
                <tr>
                    <td class="td-name">
                        <button class="btn-student-name"
                                onclick="showStudentDetail('${safeName}')">
                            ${escapeHTML(st.name)}
                        </button>
                        <button class="btn-delete-student"
                                title="${safeName} 삭제"
                                onclick="confirmDeleteStudent('${safeName}')">🗑️</button>
                    </td>
                    <td class="td-center">레벨 ${st.currentLevel}</td>
                    <td class="td-character">${st.characterName}</td>
                    <td class="td-center" style="color:${accColor};font-weight:bold">
                        ${st.accuracy}%
                    </td>
                    <td class="td-center">${st.totalCorrect}</td>
                    <td class="td-center">${st.totalWrong}</td>
                    <td class="td-center">${st.totalXP.toLocaleString()}</td>
                    <td class="td-center">${st.wrongNotesCount}</td>
                    <td class="td-weak">${weakStr}</td>
                    <td class="td-center" style="white-space:nowrap">${st.goldenFound > 0 ? '🥇 ' + st.goldenFound : '–'}</td>
                    <td class="td-center" style="white-space:nowrap;color:var(--txt-dim)">${formatLastLogin(st.lastLogin)}</td>
                </tr>
            `;
        });

    html += `
                </tbody>
            </table>
        </div>

        <!-- CSV 다운로드 버튼 -->
        <div class="teacher-actions">
            <button class="btn-csv" onclick="downloadCSV()">
                📥 CSV 다운로드
            </button>
            <button class="btn-refresh" onclick="refreshDashboard()">
                🔄 새로고침
            </button>
            <button class="btn-delete" onclick="confirmDeleteAll()">
                🗑️ 전체 데이터 삭제
            </button>
        </div>
        </div><!-- /tab-students -->

        <div id="tab-gifts" class="teacher-tab-pane" style="display:none">
            <div id="gift-pane-inner">${buildGiftView(students)}</div>
        </div>
    </div>`;

    return html;
}

/** 학생 현황 / 황금 선물 탭 전환 */
function teacherTab(which) {
    const sPane = document.getElementById('tab-students');
    const gPane = document.getElementById('tab-gifts');
    const sBtn  = document.getElementById('tt-students');
    const gBtn  = document.getElementById('tt-gifts');
    if (!sPane || !gPane) return;
    const gifts = which === 'gifts';
    sPane.style.display = gifts ? 'none' : '';
    gPane.style.display = gifts ? '' : 'none';
    if (sBtn) sBtn.classList.toggle('active', !gifts);
    if (gBtn) gBtn.classList.toggle('active', gifts);
}

/** 황금 선물 지급 화면 HTML (요약 + 학생 카드 목록) */
function buildGiftView(students) {
    const earners = students.filter(s => s.goldenFound > 0);
    if (earners.length === 0) {
        return `<div class="gift-empty">아직 황금 분수 조각을 찾은 학생이 없어요. 🥇<br>열심히 풀다 보면 여기에 나타나요!</div>`;
    }
    // 지급 대기(미지급) 먼저, 그다음 지급 완료. 같은 그룹은 최근 접속 순.
    earners.sort((a, b) => {
        const pa = a.goldenPending > 0 ? 0 : 1;
        const pb = b.goldenPending > 0 ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (b.lastLogin || '').localeCompare(a.lastLogin || '');
    });
    const pendingCount = earners.filter(s => s.goldenPending > 0).length;
    const givenTotal   = earners.reduce((s, st) => s + st.goldenGiven, 0);
    const summary = `
        <div class="gift-summary">
            <span class="gs-chip gs-pending">지급 대기 <b>${pendingCount}</b>명</span>
            <span class="gs-chip gs-given">누적 지급 <b>${givenTotal}</b>개</span>
        </div>`;
    return summary + earners.map(giftCard).join('');
}

/** 학생 한 명의 선물 카드 */
function giftCard(s) {
    const pending = s.goldenPending > 0;
    const btn = pending
        ? `<button class="gift-btn give" onclick="markGoldenGiven('${escapeAttr(s.name)}')">선물 지급</button>`
        : `<button class="gift-btn done" disabled>지급함 ✓</button>`;
    return `
    <div class="gift-card ${pending ? 'is-pending' : ''}">
        <div class="gift-icon">🥇</div>
        <div class="gift-info">
            <div class="gift-name">${escapeHTML(s.name)} <span class="gift-count">🥇 ${s.goldenFound}</span></div>
            <div class="gift-meta">Lv.${s.currentLevel} · ${formatLastLogin(s.lastLogin)}${pending ? ` · <span class="gift-wait">대기 ${s.goldenPending}</span>` : ''}</div>
        </div>
        ${btn}
    </div>`;
}

/** 선생님이 한 학생의 선물 지급을 완료 처리 (Firebase에 기록) */
async function markGoldenGiven(name) {
    const rec   = _lastTeacherData && _lastTeacherData[name];
    const found = (rec && rec.goldenFound) || 0;
    if (rec) rec.goldenGiven = found; // 캐시 즉시 반영
    try {
        if (typeof FIREBASE_URL !== 'undefined' && FIREBASE_URL && typeof nameToKey === 'function') {
            // PATCH = 다른 필드는 건드리지 않고 goldenGiven만 갱신
            await fetch(`${FIREBASE_URL}/fractionMaster/${nameToKey(name)}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goldenGiven: found })
            });
        }
    } catch (e) { /* 오프라인이어도 화면 표시는 갱신됨 */ }
    rerenderGifts();
}

/** 선물 탭만 다시 그리기 (탭 전환 유지) */
function rerenderGifts() {
    if (!_lastTeacherData) return;
    const students = Object.entries(_lastTeacherData).map(([n, d]) => calcStudentSummary(n, d));
    const inner = document.getElementById('gift-pane-inner');
    if (inner) inner.innerHTML = buildGiftView(students);
    const pendingCount = students.filter(s => s.goldenPending > 0).length;
    const gBtn = document.getElementById('tt-gifts');
    if (gBtn) gBtn.innerHTML = `🎁 황금 선물${pendingCount > 0 ? ` · 대기 ${pendingCount}` : ''}`;
}

/**
 * 레벨별 취약 학생 현황 렌더링
 * @returns {string} HTML 문자열
 */
function renderWeakStudentsByLevel() {
    const studentsRaw = getAllStudentsData();
    const students    = Object.entries(studentsRaw).map(
        ([name, data]) => calcStudentSummary(name, data)
    );

    if (students.length === 0) return '';

    const levelWeakMap = {};
    for (let lv = 1; lv <= 11; lv++) {
        levelWeakMap[lv] = students.filter(st => st.weakLevels.includes(lv));
    }

    let html = `<div class="weak-by-level"><h3>레벨별 취약 학생</h3>`;
    for (let lv = 1; lv <= 11; lv++) {
        const weak = levelWeakMap[lv];
        if (weak.length === 0) continue;
        const conceptName = CONCEPT_MAP ? (CONCEPT_MAP[lv] ? CONCEPT_MAP[lv].name : '') : '';
        html += `
        <div class="wbl-row">
            <span class="wbl-level">레벨 ${lv}${conceptName ? ` (${conceptName})` : ''}</span>
            <span class="wbl-count">${weak.length}명</span>
            <span class="wbl-names">${weak.map(s => escapeHTML(s.name)).join(', ')}</span>
        </div>`;
    }
    html += `</div>`;
    return html;
}

// ─────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────

/**
 * XSS 방지를 위한 HTML 이스케이프
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 대시보드를 새로고침합니다.
 * Firebase 설정 시 클라우드 데이터를 다시 불러옵니다.
 */
async function refreshDashboard() {
    const container = document.getElementById('teacher-content');
    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--txt-dim);">
            <div class="spinner"></div>
            <p style="margin-top:16px">학생 데이터를 불러오는 중...</p>
        </div>`;
    const merged = await getMergedStudentsData();
    container.innerHTML = renderTeacherDashboard(merged);
}

/**
 * 학생 데이터를 CSV 형식으로 내보냅니다.
 * 마지막으로 로드된 병합 데이터를 사용합니다.
 */
function downloadCSV() {
    // 가장 최근 병합 데이터 사용 (없으면 로컬 데이터)
    const studentsRaw = _lastTeacherData || getAllStudentsData();
    const students    = Object.entries(studentsRaw).map(
        ([name, data]) => calcStudentSummary(name, data)
    );

    if (students.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    const headers = [
        '이름', '현재레벨', '최고레벨', '경험치',
        '완료레벨수', '총정답수', '총오답수', '정답률(%)',
        '오답노트수', '취약레벨', '캐릭터', '황금분수', '마지막접속'
    ];

    const rows = students.map(st => [
        `"${st.name}"`,
        st.currentLevel,
        st.maxLevel,
        st.totalXP,
        st.completedLevels,
        st.totalCorrect,
        st.totalWrong,
        st.accuracy,
        st.wrongNotesCount,
        `"${st.weakLevels.map(l => `레벨${l}`).join('/')}"`,
        `"${st.characterName}"`,
        st.goldenFound,
        `"${formatLastLogin(st.lastLogin)}"`
    ]);

    const csvContent = '\uFEFF' +
        [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const today   = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

    link.href     = url;
    link.download = `분수마스터_학생현황_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────
// 학생 상세 진단 모달
// ─────────────────────────────────────────────────────────

const DETAIL_LEVEL_NAMES = ['','분수 읽기','단위분수','진분수·가분수','크기가 같은 분수','약분','공배수','최소공배수','통분','분수 비교','분수 덧셈','분수 뺄셈'];

/**
 * 학생 이름 클릭 시 상세 진단 모달을 표시합니다.
 */
function showStudentDetail(name) {
    const studentData = _lastTeacherData ? _lastTeacherData[name] : null;
    if (!studentData) { alert('학생 데이터를 찾을 수 없습니다.'); return; }

    const summary  = calcStudentSummary(name, studentData);
    const lp       = studentData.levelProgress || {};
    const notes    = studentData.wrongNotes    || [];
    const accColor = summary.accuracy >= 80 ? 'var(--clr-green)'
                   : summary.accuracy >= 60 ? 'var(--clr-orange)'
                   : 'var(--clr-red)';

    // 레벨별 진행 rows
    let levelRows = '';
    for (let lv = 1; lv <= 11; lv++) {
        const p   = lp[lv];
        if (!p) {
            levelRows += `<div class="dm-level-row dm-not-tried">
                <span class="dm-lv-num">레벨 ${lv}</span>
                <span class="dm-lv-name">${DETAIL_LEVEL_NAMES[lv]}</span>
                <span class="dm-lv-pct" style="color:var(--txt-dim)">미도전</span>
            </div>`;
            continue;
        }
        const tot   = (p.correct || 0) + (p.wrong || 0);
        const acc   = tot > 0 ? Math.round((p.correct / tot) * 100) : 0;
        const color = acc >= 80 ? 'var(--clr-green)' : acc >= 60 ? 'var(--clr-orange)' : 'var(--clr-red)';
        levelRows += `<div class="dm-level-row">
            <span class="dm-lv-num">레벨 ${lv}</span>
            <span class="dm-lv-name">${DETAIL_LEVEL_NAMES[lv]}</span>
            <div class="dm-lv-bar-wrap"><div class="dm-lv-bar" style="width:${acc}%;background:${color}"></div></div>
            <span class="dm-lv-pct" style="color:${color}">${acc}%</span>
            <span class="dm-lv-detail">${p.correct || 0}✅ ${p.wrong || 0}❌</span>
        </div>`;
    }

    const html = `
    <div class="dm-stats-row">
        <div class="dm-stat"><div class="dm-stat-val">${summary.characterName}</div><div class="dm-stat-label">캐릭터</div></div>
        <div class="dm-stat"><div class="dm-stat-val" style="color:${accColor}">${summary.accuracy}%</div><div class="dm-stat-label">전체 정답률</div></div>
        <div class="dm-stat"><div class="dm-stat-val" style="color:var(--clr-gold)">${summary.totalXP.toLocaleString()}</div><div class="dm-stat-label">경험치</div></div>
        <div class="dm-stat"><div class="dm-stat-val" style="color:var(--clr-red)">${notes.length}</div><div class="dm-stat-label">오답노트</div></div>
    </div>

    <h3 class="dm-section-title">레벨별 학습 현황</h3>
    <div class="dm-levels">${levelRows}</div>

    ${summary.weakLevels.length > 0 ? `
    <div class="dm-weak-wrap">
        <h3 class="dm-section-title">⚠️ 집중 복습 필요</h3>
        <div>${summary.weakLevels.map(lv => `<span class="dm-weak-badge">레벨 ${lv} ${DETAIL_LEVEL_NAMES[lv]}</span>`).join('')}</div>
    </div>` : ''}

    ${notes.length > 0 ? `
    <h3 class="dm-section-title">📝 오답노트 (${notes.length}개)</h3>
    <div class="dm-notes">
        ${notes.map(n => `
        <div class="dm-note-row">
            <span class="dm-note-lv">Lv.${n.level}</span>
            <span class="dm-note-q">${escapeHTML(n.question || '')}</span>
        </div>`).join('')}
    </div>` : `<p style="color:var(--txt-dim);font-size:0.9rem;margin-top:16px">오답노트가 없어요. 잘 하고 있어요! 🎉</p>`}

    <div style="margin-top:24px;padding-top:16px;border-top:var(--border-glass)">
        <button id="dm-pin-reset-btn"
                style="background:rgba(255,92,114,0.15);border:1px solid rgba(255,92,114,0.3);color:var(--clr-red);padding:10px 18px;border-radius:var(--radius-md);font-family:var(--font-main);font-size:0.9rem;cursor:pointer;">
            🔑 PIN 초기화 (학생이 PIN을 잊었을 때)
        </button>
    </div>`;

    document.getElementById('teacher-modal-title').textContent = `${escapeHTML(name)}의 학습 진단`;
    document.getElementById('teacher-modal-content').innerHTML = html;

    // PIN 초기화 버튼 동작 연결
    const pinBtn = document.getElementById('dm-pin-reset-btn');
    if (pinBtn) {
        pinBtn.onclick = () => resetStudentPin(name);
    }

    document.getElementById('teacher-student-modal').classList.add('visible');

    // 진행 바 애니메이션
    setTimeout(() => {
        document.querySelectorAll('.dm-lv-bar').forEach(bar => {
            const w = bar.style.width;
            bar.style.width = '0';
            requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = w; }));
        });
    }, 50);
}

function closeStudentModal() {
    document.getElementById('teacher-student-modal').classList.remove('visible');
}

/**
 * 학생 PIN 초기화 (선생님이 학생 요청 시 사용)
 */
async function resetStudentPin(name) {
    if (!confirm(`"${name}" 학생의 PIN을 초기화하시겠습니까?\n다음 로그인 시 새 PIN을 설정하게 됩니다.`)) return;

    // 로컬 PIN 삭제
    try {
        const raw = localStorage.getItem('fractionMaster');
        if (raw) {
            const data = JSON.parse(raw);
            if (data.students && data.students[name]) {
                delete data.students[name].pin;
                localStorage.setItem('fractionMaster', JSON.stringify(data));
            }
        }
    } catch (e) {}

    // Firebase PIN 삭제
    const fbUrl = (typeof FIREBASE_URL !== 'undefined') ? FIREBASE_URL : '';
    if (fbUrl) {
        try {
            await fetch(
                `${fbUrl}/fractionMaster/${encodeURIComponent(name).replace(/\./g,'%2E')}/pin.json`,
                { method: 'DELETE' }
            );
        } catch (e) {}
    }

    alert(`${name} 학생의 PIN이 초기화됐습니다.\n다음 로그인 시 새 PIN을 설정합니다.`);
    closeStudentModal();
}

/**
 * 특정 학생 데이터 삭제 — 로컬 + Firebase
 */
async function confirmDeleteStudent(name) {
    if (!confirm(`⚠️ "${name}" 학생의 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    // 로컬 삭제
    try {
        const raw = localStorage.getItem('fractionMaster');
        if (raw) {
            const data = JSON.parse(raw);
            if (data.students && data.students[name]) {
                delete data.students[name];
                // 현재 로그인 학생이 삭제 대상이면 초기화
                if (data.currentStudent === name) data.currentStudent = '';
                localStorage.setItem('fractionMaster', JSON.stringify(data));
            }
        }
    } catch (e) {
        console.warn('로컬 삭제 오류:', e);
    }

    // Firebase 삭제
    const fbUrl = (typeof FIREBASE_URL !== 'undefined') ? FIREBASE_URL : '';
    if (fbUrl) {
        try {
            await fetch(
                `${fbUrl}/fractionMaster/${encodeURIComponent(name).replace(/\./g, '%2E')}.json`,
                { method: 'DELETE' }
            );
        } catch (e) {
            console.warn('Firebase 삭제 오류:', e);
        }
    }

    // 캐시 갱신 후 대시보드 새로고침
    if (_lastTeacherData) delete _lastTeacherData[name];
    await refreshDashboard();
}

/**
 * 전체 데이터 삭제 — 로컬 + Firebase 모두 삭제
 */
async function confirmDeleteAll() {
    if (!confirm('⚠️ 모든 학생 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

    // 로컬 삭제
    localStorage.removeItem('fractionMaster');
    _lastTeacherData = null;

    // Firebase 삭제 (설정된 경우)
    const fbUrl = (typeof FIREBASE_URL !== 'undefined') ? FIREBASE_URL : '';
    if (fbUrl) {
        try {
            await fetch(`${fbUrl}/fractionMaster.json`, { method: 'DELETE' });
        } catch {
            // 실패해도 계속 진행
        }
    }

    await refreshDashboard();
    alert('모든 데이터가 삭제되었습니다.');
}
