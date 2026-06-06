/**
 * diagnosis.js - 분수 마스터 학습 진단 시스템
 * =====================================================
 * 학생의 오답 패턴을 분석하여 취약 개념을 파악하고
 * 맞춤형 학습 추천을 제공합니다.
 */

'use strict';

// ─────────────────────────────────────────────────────────
// 개념 맵: 각 레벨이 다루는 핵심 개념
// ─────────────────────────────────────────────────────────

const CONCEPT_MAP = {
    1: {
        name: '분수 읽기',
        concepts: ['분자', '분모', '분수 표기법'],
        prerequisite: [],
        description: '분수를 올바르게 읽고 쓰는 방법'
    },
    2: {
        name: '단위분수',
        concepts: ['단위분수', '분수의 크기', '분모와 크기의 관계'],
        prerequisite: [1],
        description: '분자가 1인 분수(단위분수)의 크기 비교'
    },
    3: {
        name: '진분수와 가분수',
        concepts: ['진분수', '가분수', '대분수'],
        prerequisite: [1, 2],
        description: '진분수·가분수·대분수의 구분과 변환'
    },
    4: {
        name: '크기가 같은 분수',
        concepts: ['크기가 같은 분수', '크기가 같은 분수 만들기', '크기 비교'],
        prerequisite: [1, 2, 3],
        description: '크기가 같은 분수 찾기'
    },
    5: {
        name: '약분',
        concepts: ['약분', '최대공약수', '기약분수'],
        prerequisite: [1, 2, 3, 4],
        description: '분수를 기약분수로 약분하기'
    },
    6: {
        name: '공배수',
        concepts: ['배수', '공배수', '배수 구하기'],
        prerequisite: [1, 2],
        description: '두 수의 공배수 찾기'
    },
    7: {
        name: '최소공배수',
        concepts: ['최소공배수', 'LCM', '최소공배수 계산'],
        prerequisite: [6],
        description: '두 수의 최소공배수 구하기'
    },
    8: {
        name: '통분',
        concepts: ['통분', '공통분모', '최소공배수를 이용한 통분'],
        prerequisite: [5, 6, 7],
        description: '두 분수를 공통분모로 통분하기'
    },
    9: {
        name: '분수 크기 비교',
        concepts: ['분수 비교', '통분 후 비교', '크기 비교'],
        prerequisite: [8],
        description: '통분을 이용한 분수의 크기 비교'
    },
    10: {
        name: '분수의 덧셈',
        concepts: ['이분모 덧셈', '통분 후 덧셈', '받아올림'],
        prerequisite: [8, 9],
        description: '통분이 필요한 분수의 덧셈'
    },
    11: {
        name: '분수의 뺄셈',
        concepts: ['이분모 뺄셈', '통분 후 뺄셈', '받아내림'],
        prerequisite: [8, 9, 10],
        description: '통분이 필요한 분수의 뺄셈'
    }
};

// ─────────────────────────────────────────────────────────
// 취약점 임계값 설정
// ─────────────────────────────────────────────────────────

const THRESHOLDS = {
    CRITICAL:  0.40,  // 40% 미만: 심각한 취약
    WEAK:      0.60,  // 60% 미만: 취약
    MODERATE:  0.80,  // 80% 미만: 보통
    GOOD:      1.00   // 80% 이상: 양호
};

// ─────────────────────────────────────────────────────────
// 진단 메시지 템플릿
// ─────────────────────────────────────────────────────────

const DIAGNOSIS_MESSAGES = {
    // 레벨별 맞춤 취약점 메시지
    levelWeakness: {
        1: [
            "분모와 분자의 위치를 헷갈리고 있어요. 아래가 분모, 위가 분자예요!",
            "분수 읽는 순서를 다시 연습해요. 분모 먼저, '분의', 그 다음 분자!"
        ],
        2: [
            "단위분수는 분모가 클수록 더 작아요. 1/10이 1/2보다 작답니다!",
            "분모의 숫자가 크면 전체를 더 잘게 나눈 것이에요."
        ],
        3: [
            "가분수는 분자가 분모보다 크거나 같은 분수예요 (예: 5/3).",
            "진분수는 분자가 분모보다 작은 분수예요 (예: 2/3)."
        ],
        4: [
            "크기가 같은 분수를 만들 때 분자와 분모를 같은 수로 곱하거나 나눠요.",
            "1/2 = 2/4 = 3/6... 분자와 분모를 같은 수로 곱해보세요!"
        ],
        5: [
            "최대공약수를 먼저 구한 뒤 분자·분모를 나눠야 해요.",
            "약분은 분자와 분모의 공약수로 계속 나누는 과정이에요."
        ],
        6: [
            "공배수는 두 수의 배수 중 공통된 것이에요. 배수 목록을 써봐요.",
            "4의 배수: 4, 8, 12, 16... 6의 배수: 6, 12, 18... 공통된 건 12, 24..."
        ],
        7: [
            "최소공배수는 공배수 중 가장 작은 수예요.",
            "두 수의 배수를 각각 나열하고 처음 만나는 수를 찾으세요!"
        ],
        8: [
            "통분할 때는 두 분모의 최소공배수를 공통분모로 사용해요.",
            "1/3과 1/4를 통분하면: LCM(3,4)=12 → 4/12와 3/12!"
        ],
        9: [
            "분수 크기를 비교할 때는 먼저 통분해서 분모를 같게 만들어요.",
            "통분 후에는 분자가 큰 분수가 더 크답니다."
        ],
        10: [
            "이분모 덧셈은 통분 → 분자끼리 더하기 순서로 해요.",
            "1/2 + 1/3 = 3/6 + 2/6 = 5/6 처럼 통분 후 분자만 더해요."
        ],
        11: [
            "이분모 뺄셈도 통분 먼저 한 뒤 분자끼리 빼요.",
            "3/4 - 1/3 = 9/12 - 4/12 = 5/12 처럼 계산해요."
        ]
    },

    // 성취 수준별 격려 메시지
    achievement: {
        excellent: [
            "🌟 완벽해요! 이 개념을 완전히 이해했어요!",
            "🏆 훌륭합니다! 분수 마스터에 한 걸음 가까워졌어요!",
            "⭐ 대단해요! 실력이 쑥쑥 늘고 있어요!"
        ],
        good: [
            "👍 잘하고 있어요! 조금만 더 연습하면 완벽해질 거예요.",
            "💪 좋아요! 거의 다 이해했어요. 틀린 문제만 다시 봐요.",
            "😊 잘했어요! 몇 가지만 더 확인하면 될 것 같아요."
        ],
        moderate: [
            "🤔 이 부분이 좀 어렵죠? 힌트를 보면서 다시 도전해봐요!",
            "📚 조금 더 연습이 필요해요. 오답노트를 확인해봐요!",
            "💡 어려운 문제예요. 차근차근 다시 살펴봐요!"
        ],
        weak: [
            "😅 이 개념이 헷갈리나요? 이전 단계부터 다시 해봐요!",
            "🔄 기초부터 다시 공부해봐요. 천천히 해도 괜찮아요!",
            "🌱 아직 어렵겠지만, 포기하지 마세요! 함께 다시 해봐요."
        ]
    },

    // 복습 추천 메시지
    reviewRecommendation: {
        sameLevel: "이 레벨을 한 번 더 연습해보세요!",
        prerequisite: (levelName) => `먼저 '${levelName}' 개념을 복습하는 게 좋겠어요.`,
        wrongNotes: "오답노트에서 틀린 문제들을 다시 풀어보세요!"
    }
};

// ─────────────────────────────────────────────────────────
// 핵심 진단 함수
// ─────────────────────────────────────────────────────────

/**
 * 특정 레벨의 수행 결과를 진단합니다.
 * @param {number} level - 진단할 레벨 (1~11)
 * @param {number} correct - 맞힌 문제 수
 * @param {number} total - 전체 문제 수
 * @param {Array}  wrongQuestions - 틀린 문제 배열
 * @returns {object} 진단 결과 객체
 */
function diagnoseLevel(level, correct, total, wrongQuestions = []) {
    const accuracy = total > 0 ? correct / total : 0;
    const conceptInfo = CONCEPT_MAP[level];

    // 성취 수준 판정
    let achievementLevel;
    if (accuracy >= THRESHOLDS.MODERATE) {
        achievementLevel = 'excellent';
    } else if (accuracy >= THRESHOLDS.WEAK) {
        achievementLevel = 'good';
    } else if (accuracy >= THRESHOLDS.CRITICAL) {
        achievementLevel = 'moderate';
    } else {
        achievementLevel = 'weak';
    }

    // 격려 메시지 선택 (랜덤)
    const messages = DIAGNOSIS_MESSAGES.achievement[achievementLevel];
    const encouragement = messages[Math.floor(Math.random() * messages.length)];

    // 취약점 메시지 (80% 미만일 때)
    let weaknessMessages = [];
    if (accuracy < THRESHOLDS.MODERATE) {
        const levelMsgs = DIAGNOSIS_MESSAGES.levelWeakness[level] || [];
        weaknessMessages = levelMsgs.slice();
    }

    // 선행 학습 추천 (60% 미만일 때)
    let reviewSuggestions = [];
    if (accuracy < THRESHOLDS.WEAK && conceptInfo.prerequisite.length > 0) {
        conceptInfo.prerequisite.forEach(preLevel => {
            reviewSuggestions.push({
                level: preLevel,
                name: CONCEPT_MAP[preLevel].name,
                message: DIAGNOSIS_MESSAGES.reviewRecommendation.prerequisite(CONCEPT_MAP[preLevel].name)
            });
        });
    }

    // 오답 패턴 분석
    const wrongPatterns = analyzeWrongPatterns(wrongQuestions, level);

    return {
        level,
        levelName: conceptInfo.name,
        correct,
        total,
        accuracy: Math.round(accuracy * 100),
        achievementLevel,
        encouragement,
        weaknessMessages,
        reviewSuggestions,
        wrongPatterns,
        needsReview: accuracy < THRESHOLDS.MODERATE,
        concepts: conceptInfo.concepts
    };
}

/**
 * 전체 학습 이력을 종합 진단합니다.
 * @param {object} studentData - 학생 데이터 (LocalStorage에서 가져온 것)
 * @returns {object} 종합 진단 결과
 */
function diagnoseAll(studentData) {
    const levelProgress = studentData.levelProgress || {};
    const wrongNotes    = studentData.wrongNotes    || [];
    const results = [];

    // 완료된 레벨들 분석
    Object.entries(levelProgress).forEach(([lvl, progress]) => {
        if (!progress) return; // Firebase null 값 방어
        const level = parseInt(lvl);
        const correct = progress.correct || 0;
        const wrong   = progress.wrong   || 0;
        if (progress.completed || (correct + wrong) > 0) {
            const total = correct + wrong;
            const levelWrong = wrongNotes.filter(n => n && n.level === level);
            results.push(diagnoseLevel(level, correct, total, levelWrong));
        }
    });

    // 전체 정확도 계산
    const totalCorrect = results.reduce((s, r) => s + r.correct, 0);
    const totalQuestions = results.reduce((s, r) => s + r.total, 0);
    const overallAccuracy = totalQuestions > 0
        ? Math.round((totalCorrect / totalQuestions) * 100)
        : 0;

    // 가장 취약한 레벨 찾기
    const weakLevels = results
        .filter(r => r.accuracy < THRESHOLDS.WEAK * 100)
        .sort((a, b) => a.accuracy - b.accuracy);

    // 강점 레벨 찾기
    const strongLevels = results
        .filter(r => r.accuracy >= THRESHOLDS.MODERATE * 100)
        .sort((a, b) => b.accuracy - a.accuracy);

    // 다음 추천 학습
    const nextRecommendation = getNextRecommendation(studentData, results);

    return {
        results,
        overallAccuracy,
        totalCorrect,
        totalQuestions,
        weakLevels,
        strongLevels,
        nextRecommendation,
        wrongNotesCount: wrongNotes.length
    };
}

/**
 * 틀린 문제 패턴을 분석합니다.
 * @param {Array} wrongQuestions - 오답 배열
 * @param {number} level - 레벨 번호
 * @returns {Array} 패턴 목록
 */
function analyzeWrongPatterns(wrongQuestions, level) {
    if (!wrongQuestions || wrongQuestions.length === 0) return [];

    const patterns = [];

    // 반복 오답 확인 (같은 문제를 2번 이상 틀림)
    const questionCount = {};
    wrongQuestions.forEach(q => {
        const key = q.question || q.questionText;
        if (key) {
            questionCount[key] = (questionCount[key] || 0) + 1;
        }
    });

    const repeatedErrors = Object.entries(questionCount)
        .filter(([, count]) => count >= 2)
        .map(([question]) => question);

    if (repeatedErrors.length > 0) {
        patterns.push({
            type: 'repeated',
            message: `같은 문제를 여러 번 틀렸어요. 특히 어려운 부분이 있는 것 같아요.`,
            questions: repeatedErrors
        });
    }

    return patterns;
}

/**
 * 다음 학습 추천을 생성합니다.
 * @param {object} studentData - 학생 데이터
 * @param {Array} diagnosisResults - 진단 결과 배열
 * @returns {object} 추천 정보
 */
function getNextRecommendation(studentData, diagnosisResults) {
    const currentLevel = studentData.currentLevel || 1;
    const wrongNotes   = studentData.wrongNotes   || [];

    // 오답노트가 많으면 복습 우선
    if (wrongNotes.length >= 5) {
        return {
            type: 'review',
            message: `오답노트에 ${wrongNotes.length}개의 문제가 쌓였어요. 복습하고 다음 단계로 가요!`,
            action: 'wrongNotes'
        };
    }

    // 취약한 레벨이 있으면 재도전 추천
    const weakResult = diagnosisResults.find(
        r => r.level < currentLevel && r.accuracy < THRESHOLDS.WEAK * 100
    );
    if (weakResult) {
        return {
            type: 'retry',
            message: `레벨 ${weakResult.level}(${weakResult.levelName})이 약해요. 다시 도전해봐요!`,
            action: 'level',
            targetLevel: weakResult.level
        };
    }

    // 현재 레벨 도전 추천
    if (currentLevel <= 11) {
        return {
            type: 'next',
            message: `레벨 ${currentLevel}에 도전할 준비가 됐어요! 화이팅!`,
            action: 'level',
            targetLevel: currentLevel
        };
    }

    // 전 레벨 완료
    return {
        type: 'complete',
        message: '모든 레벨을 완료했어요! 분수 마스터가 됐어요! 🎉',
        action: 'complete'
    };
}

// ─────────────────────────────────────────────────────────
// UI 렌더링 헬퍼 함수
// ─────────────────────────────────────────────────────────

/**
 * 진단 결과를 HTML 문자열로 렌더링합니다.
 * @param {object} diagnosisData - diagnoseAll() 반환값
 * @returns {string} HTML 문자열
 */
function renderDiagnosisHTML(diagnosisData) {
    const { results, overallAccuracy, weakLevels, strongLevels,
            nextRecommendation, wrongNotesCount } = diagnosisData;

    // 전체 점수 색상
    const scoreColor = overallAccuracy >= 80 ? '#4CAF50'
                     : overallAccuracy >= 60 ? '#FF9800'
                     : '#F44336';

    let html = `
    <div class="diagnosis-container">
        <!-- 전체 성취도 -->
        <div class="diagnosis-overall">
            <div class="overall-score" style="color:${scoreColor}">
                ${overallAccuracy}%
            </div>
            <div class="overall-label">전체 정답률</div>
        </div>

        <!-- 추천 학습 -->
        <div class="diagnosis-recommendation">
            <div class="rec-icon">
                ${nextRecommendation.type === 'complete' ? '🏆'
                : nextRecommendation.type === 'review'   ? '📝'
                : nextRecommendation.type === 'retry'    ? '🔄'
                : '🚀'}
            </div>
            <div class="rec-message">${nextRecommendation.message}</div>
        </div>
    `;

    // 레벨별 결과
    if (results.length > 0) {
        html += `<div class="diagnosis-levels"><h3>레벨별 성취도</h3>`;
        results.forEach(result => {
            const barColor = result.accuracy >= 80 ? '#4CAF50'
                           : result.accuracy >= 60 ? '#FF9800'
                           : '#F44336';
            const emoji = result.accuracy >= 80 ? '⭐'
                        : result.accuracy >= 60 ? '👍'
                        : result.accuracy >= 40 ? '💪'
                        : '😅';
            html += `
            <div class="level-result-item">
                <div class="lri-header">
                    <span class="lri-emoji">${emoji}</span>
                    <span class="lri-name">레벨 ${result.level}: ${result.levelName}</span>
                    <span class="lri-score">${result.accuracy}%</span>
                </div>
                <div class="lri-bar-bg">
                    <div class="lri-bar-fill" style="width:${result.accuracy}%;background:${barColor}"></div>
                </div>
                ${result.weaknessMessages.length > 0 ? `
                <div class="lri-hint">💡 ${result.weaknessMessages[0]}</div>
                ` : ''}
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="diagnosis-empty">
            아직 학습 기록이 없어요. 게임을 먼저 시작해봐요! 🎮
        </div>`;
    }

    // 취약 레벨 강조
    if (weakLevels.length > 0) {
        html += `<div class="diagnosis-weak">
            <h3>⚠️ 복습이 필요한 레벨</h3>
            <ul>`;
        weakLevels.forEach(w => {
            html += `<li>레벨 ${w.level}(${w.levelName}): ${w.accuracy}% — ${w.weaknessMessages[0] || ''}</li>`;
        });
        html += `</ul></div>`;
    }

    // 오답노트 안내
    if (wrongNotesCount > 0) {
        html += `<div class="diagnosis-wrong-note">
            📝 오답노트에 <strong>${wrongNotesCount}개</strong>의 문제가 있어요.
        </div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * 레벨 완료 직후 간단한 피드백 메시지를 생성합니다.
 * @param {number} level   - 완료한 레벨
 * @param {number} correct - 정답 수
 * @param {number} total   - 전체 문제 수
 * @returns {object} { emoji, title, message, needsReview }
 */
function getLevelCompleteFeedback(level, correct, total) {
    const accuracy = total > 0 ? correct / total : 0;
    const result   = diagnoseLevel(level, correct, total);

    let emoji, title;
    if (accuracy >= 0.9) {
        emoji = '🏆'; title = '완벽해요!';
    } else if (accuracy >= 0.7) {
        emoji = '⭐'; title = '잘했어요!';
    } else if (accuracy >= 0.5) {
        emoji = '👍'; title = '노력했어요!';
    } else {
        emoji = '💪'; title = '다시 도전해봐요!';
    }

    return {
        emoji,
        title,
        message: result.encouragement,
        accuracy: Math.round(accuracy * 100),
        weaknessMessages: result.weaknessMessages,
        needsReview: result.needsReview
    };
}
