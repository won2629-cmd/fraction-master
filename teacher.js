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
    // script.js 보다 먼저 로드되므로 typeof 체크 필요
    const fbUrl = (typeof FIREBASE_URL !== 'undefined') ? FIREBASE_URL : '';
    if (!fbUrl) return {};
    try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 5000);
        const res  = await fetch(`${fbUrl}/fractionMaster.json`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) return {};
        const raw = await res.json();
        if (!raw || typeof raw !== 'object') return {};

        // Firebase 키(encodeURIComponent 인코딩) → 실제 학생 이름으로 디코딩
        const decoded = {};
        Object.entries(raw).forEach(([key, val]) => {
            if (!val || typeof val !== 'object') return;
            try { decoded[decodeURIComponent(key)] = val; }
            catch { decoded[key] = val; }
        });
        return decoded;
    } catch {
        return {}; // 오프라인 / 타임아웃 → 조용히 무시
    }
}

/**
 * 로컬 + 클라우드 학생 데이터를 병합합니다.
 * 기준: totalXP가 더 높은 쪽 (더 진행된 기기의 기록 우선)
 * @returns {Promise<object>} 병합된 { studentName: studentData, ... }
 */
async function getMergedStudentsData() {
    const local = getAllStudentsData();
    const cloud = await getAllStudentsFromCloud();

    const merged = { ...local };
    Object.entries(cloud).forEach(([name, cloudData]) => {
        const localData = merged[name];
        if (!localData || (cloudData.totalXP || 0) > (localData.totalXP || 0)) {
            merged[name] = cloudData;
        }
    });

    _lastTeacherData = merged; // 캐시 갱신
    return merged;
}



/**
 * 학생 요약 통계를 계산합니다.
 * @param {string} name - 학생 이름
 * @param {object} data - 학생 데이터
 * @returns {object} 요약 통계
 */
function calcStudentSummary(name, data) {
    const levelProgress = data.levelProgress || {};
    const wrongNotes    = data.wrongNotes    || [];
    const completedLevels = Object.values(levelProgress).filter(p => p.completed).length;
    const totalCorrect    = data.correctCount || 0;
    const totalWrong      = data.wrongCount   || 0;
    const totalAnswered   = totalCorrect + totalWrong;
    const accuracy        = totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    // 취약 레벨 찾기
    const weakLevels = [];
    Object.entries(levelProgress).forEach(([lvl, p]) => {
        const total = p.correct + p.wrong;
        if (total >= 5 && p.correct / total < 0.6) {
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
        lastPlayed: data.lastPlayed || '기록 없음'
    };
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

    let html = `
    <div class="teacher-dashboard">
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
            html += `
                <tr>
                    <td class="td-name">${escapeHTML(st.name)}</td>
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
    </div>`;

    return html;
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
        '오답노트수', '취약레벨', '캐릭터'
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
        `"${st.characterName}"`
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
