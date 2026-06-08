/**
 * questions.js - 분수 마스터 문제 은행
 * =====================================================
 * 레벨 1~11의 모든 문제를 정의합니다.
 * 각 레벨당 15개 이상의 문제가 있어 매번 다른 문제가 출제됩니다.
 *
 * 문제 구조 (question object):
 * {
 *   question : string   - 질문 텍스트
 *   display  : object   - 화면에 표시할 분수 정보
 *   options  : string[] - 4개의 선택지
 *   correct  : number   - 정답 인덱스 (0~3)
 *   hint     : string   - 오답 시 표시할 힌트
 * }
 *
 * display.type 종류:
 *   'text'    - 추가 시각 표시 없음 (질문 텍스트만)
 *   'single'  - 분수 하나 표시  { num, den }
 *   'compare' - 두 분수 비교    { frac1:{num,den}, frac2:{num,den} }
 *   'pair'    - 통분용 두 분수  { frac1:{num,den}, frac2:{num,den} }
 *   'multi'   - 여러 분수       { fracs:[{num,den},...] }
 *   'calc'    - 계산식          { expr: '1/2 + 1/3' }
 */

'use strict';

// ─────────────────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────────────────

/** 최대공약수 계산 (Greatest Common Divisor) */
function gcd(a, b) {
    while (b !== 0) { [a, b] = [b, a % b]; }
    return a;
}

/** 최소공배수 계산 (Least Common Multiple) */
function lcm(a, b) {
    return (a * b) / gcd(a, b);
}

/** 배열을 무작위로 섞기 (Fisher-Yates 알고리즘) */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 한 문제의 보기(options) 순서를 무작위로 섞고 정답 인덱스를 다시 계산합니다.
 * 정답이 항상 같은 자리(특히 2번째)에 오던 편향을 없애, '찍기'를 방지합니다.
 * 원본 풀 객체는 건드리지 않고 새 객체를 반환하며, 중복 판별용으로 _orig에 원본을 보관합니다.
 * @param {Object} q 원본 문제 객체
 * @returns {Object} 보기가 섞인 새 문제 객체
 */
function withShuffledOptions(q) {
    if (!q || !Array.isArray(q.options)) return q;
    // 0..n-1 인덱스를 섞은 뒤, 그 순서대로 보기를 재배열
    const order      = shuffleArray(q.options.map((_, i) => i));
    const newOptions = order.map(i => q.options[i]);
    const newCorrect = order.indexOf(q.correct);
    return { ...q, options: newOptions, correct: newCorrect, _orig: q._orig || q };
}

// ─────────────────────────────────────────────────────────
// 레벨별 문제 풀 (QUESTION_POOL)
// ─────────────────────────────────────────────────────────

const QUESTION_POOL = {

    // ===================================================
    // 레벨 1: 분수 읽기
    // ===================================================
    1: [
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 1, den: 2 },
          options: ["이분의 일", "일분의 이", "삼분의 일", "이분의 삼"],
          correct: 0, hint: "💡 아래 숫자(분모)를 먼저 읽고 '분의'를 붙인 후, 위 숫자(분자)를 읽어요!\n분모 2 = '이분의', 분자 1 = '일' → 이분의 일" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 1, den: 3 },
          options: ["이분의 일", "삼분의 일", "사분의 일", "삼분의 삼"],
          correct: 1, hint: "💡 분모 3 = '삼분의', 분자 1 = '일' → 삼분의 일" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 2, den: 3 },
          options: ["삼분의 이", "이분의 삼", "사분의 이", "삼분의 삼"],
          correct: 0, hint: "💡 분모 3 = '삼분의', 분자 2 = '이' → 삼분의 이" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 3, den: 4 },
          options: ["삼분의 사", "사분의 삼", "오분의 삼", "사분의 사"],
          correct: 1, hint: "💡 분모 4 = '사분의', 분자 3 = '삼' → 사분의 삼" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 2, den: 5 },
          options: ["이분의 오", "오분의 이", "육분의 이", "오분의 삼"],
          correct: 1, hint: "💡 분모 5 = '오분의', 분자 2 = '이' → 오분의 이" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 4, den: 5 },
          options: ["사분의 오", "오분의 사", "육분의 사", "오분의 오"],
          correct: 1, hint: "💡 분모 5 = '오분의', 분자 4 = '사' → 오분의 사" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 5, den: 6 },
          options: ["오분의 육", "육분의 오", "칠분의 오", "육분의 육"],
          correct: 1, hint: "💡 분모 6 = '육분의', 분자 5 = '오' → 육분의 오" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 3, den: 7 },
          options: ["칠분의 삼", "삼분의 칠", "팔분의 삼", "칠분의 사"],
          correct: 0, hint: "💡 분모 7 = '칠분의', 분자 3 = '삼' → 칠분의 삼" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 5, den: 8 },
          options: ["팔분의 오", "오분의 팔", "팔분의 육", "구분의 오"],
          correct: 0, hint: "💡 분모 8 = '팔분의', 분자 5 = '오' → 팔분의 오" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 7, den: 8 },
          options: ["칠분의 팔", "팔분의 칠", "구분의 칠", "팔분의 팔"],
          correct: 1, hint: "💡 분모 8 = '팔분의', 분자 7 = '칠' → 팔분의 칠" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 3, den: 10 },
          options: ["삼분의 십", "십분의 삼", "십분의 사", "구분의 삼"],
          correct: 1, hint: "💡 분모 10 = '십분의', 분자 3 = '삼' → 십분의 삼" },
        { question: "다음 분수를 어떻게 읽나요?", display: { type: 'single', num: 1, den: 9 },
          options: ["팔분의 일", "구분의 일", "십분의 일", "구분의 이"],
          correct: 1, hint: "💡 분모 9 = '구분의', 분자 1 = '일' → 구분의 일" },
        { question: "'오분의 삼'을 분수로 나타내면?", display: { type: 'text' },
          options: ["5/3", "3/5", "3/4", "5/5"],
          correct: 1, hint: "💡 '오분의 삼'에서 오(5)가 분모, 삼(3)이 분자 → 3/5" },
        { question: "'사분의 일'을 분수로 나타내면?", display: { type: 'text' },
          options: ["4/1", "1/4", "1/3", "2/4"],
          correct: 1, hint: "💡 '사분의 일'에서 사(4)가 분모, 일(1)이 분자 → 1/4" },
        { question: "'삼분의 이'를 분수로 나타내면?", display: { type: 'text' },
          options: ["3/2", "2/3", "2/4", "3/3"],
          correct: 1, hint: "💡 '삼분의 이'에서 삼(3)이 분모, 이(2)가 분자 → 2/3" },
        { question: "'칠분의 사'를 분수로 나타내면?", display: { type: 'text' },
          options: ["7/4", "4/7", "4/6", "7/7"],
          correct: 1, hint: "💡 '칠분의 사'에서 칠(7)이 분모, 사(4)가 분자 → 4/7" },
    ],

    // ===================================================
    // 레벨 2: 단위분수 이해
    // ===================================================
    2: [
        { question: "다음 중 가장 큰 단위분수는?",
          display: { type: 'multi', fracs: [{num:1,den:2},{num:1,den:3},{num:1,den:5}] },
          options: ["1/2", "1/3", "1/5", "모두 같다"],
          correct: 0, hint: "💡 단위분수는 분모가 작을수록 더 큰 값이에요!\n1/2 > 1/3 > 1/5" },
        { question: "다음 중 가장 작은 단위분수는?",
          display: { type: 'multi', fracs: [{num:1,den:3},{num:1,den:6},{num:1,den:9}] },
          options: ["1/3", "1/6", "1/9", "모두 같다"],
          correct: 2, hint: "💡 분모가 클수록 단위분수는 작아져요!\n1/3 > 1/6 > 1/9" },
        { question: "1/4과 1/6 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:1,den:4}, frac2:{num:1,den:6} },
          options: ["1/4", "1/6", "같다", "알 수 없다"],
          correct: 0, hint: "💡 단위분수는 분모가 작을수록 커요.\n4 < 6이므로 1/4 > 1/6" },
        { question: "1/2과 1/8 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:1,den:2}, frac2:{num:1,den:8} },
          options: ["1/2", "1/8", "같다", "알 수 없다"],
          correct: 0, hint: "💡 분모 2 < 분모 8이므로 1/2 > 1/8" },
        { question: "단위분수란 무엇인가요?",
          display: { type: 'text' },
          options: ["분자가 1인 분수", "분모가 1인 분수", "분자=분모인 분수", "분자>분모인 분수"],
          correct: 0, hint: "💡 단위분수는 분자가 1인 분수예요. 예: 1/2, 1/3, 1/7" },
        { question: "1/5와 1/3 중 더 작은 수는?",
          display: { type: 'compare', frac1:{num:1,den:5}, frac2:{num:1,den:3} },
          options: ["1/5", "1/3", "같다", "알 수 없다"],
          correct: 0, hint: "💡 5 > 3이므로 1/5 < 1/3. 1/5가 더 작아요!" },
        { question: "다음 중 가장 큰 단위분수는?",
          display: { type: 'multi', fracs: [{num:1,den:4},{num:1,den:7},{num:1,den:10}] },
          options: ["1/4", "1/7", "1/10", "모두 같다"],
          correct: 0, hint: "💡 분모가 작을수록 단위분수가 커요!\n1/4 > 1/7 > 1/10" },
        { question: "피자를 가장 적은 조각으로 나눴을 때 한 조각이 가장 크다. 맞나요?",
          display: { type: 'text' },
          options: ["맞다", "틀리다", "상황에 따라 다르다", "알 수 없다"],
          correct: 0, hint: "💡 예: 피자를 2조각으로 나누면 1/2, 8조각이면 1/8\n1/2 > 1/8이므로 맞아요!" },
        { question: "1/10 보다 큰 단위분수는?",
          display: { type: 'text' },
          options: ["1/12", "1/15", "1/8", "1/20"],
          correct: 2, hint: "💡 8 < 10이므로 1/8 > 1/10" },
        { question: "1/7보다 크고 1/3보다 작은 단위분수는?",
          display: { type: 'text' },
          options: ["1/2", "1/5", "1/8", "1/1"],
          correct: 1, hint: "💡 1/7 < 1/5 < 1/3 이므로 1/5가 정답!" },
        { question: "다음 단위분수를 크기가 큰 순서로 나열할 때 두 번째는?",
          display: { type: 'multi', fracs: [{num:1,den:2},{num:1,den:5},{num:1,den:3},{num:1,den:8}] },
          options: ["1/2", "1/5", "1/3", "1/8"],
          correct: 2, hint: "💡 크기 순서: 1/2 > 1/3 > 1/5 > 1/8\n두 번째는 1/3" },
        { question: "물 1/3컵과 1/4컵 중 더 많은 양은?",
          display: { type: 'compare', frac1:{num:1,den:3}, frac2:{num:1,den:4} },
          options: ["1/3컵", "1/4컵", "같다", "알 수 없다"],
          correct: 0, hint: "💡 분모 3 < 4이므로 1/3 > 1/4. 1/3컵이 더 많아요!" },
        { question: "분모가 100인 단위분수와 분모가 10인 단위분수 중 더 큰 것은?",
          display: { type: 'text' },
          options: ["1/100", "1/10", "같다", "알 수 없다"],
          correct: 1, hint: "💡 분모 10 < 100이므로 1/10 > 1/100" },
        { question: "다음 중 가장 작은 단위분수는?",
          display: { type: 'multi', fracs: [{num:1,den:4},{num:1,den:2},{num:1,den:8}] },
          options: ["1/4", "1/2", "1/8", "모두 같다"],
          correct: 2, hint: "💡 분모가 클수록 작아요. 8이 가장 크므로 1/8이 가장 작아요!" },
        { question: "1/9과 1/11 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:1,den:9}, frac2:{num:1,den:11} },
          options: ["1/9", "1/11", "같다", "알 수 없다"],
          correct: 0, hint: "💡 9 < 11이므로 1/9 > 1/11" },
    ],

    // ===================================================
    // 레벨 3: 진분수와 가분수 구분
    // ===================================================
    3: [
        { question: "다음 중 가분수는?",
          display: { type: 'multi', fracs: [{num:3,den:4},{num:5,den:4},{num:2,den:3},{num:1,den:6}] },
          options: ["3/4", "5/4", "2/3", "1/6"],
          correct: 1, hint: "💡 가분수는 분자 ≥ 분모인 분수!\n5/4에서 5 ≥ 4 → 가분수" },
        { question: "다음 중 진분수는?",
          display: { type: 'multi', fracs: [{num:7,den:5},{num:4,den:4},{num:3,den:7},{num:9,den:8}] },
          options: ["7/5", "4/4", "3/7", "9/8"],
          correct: 2, hint: "💡 진분수는 분자 < 분모인 분수!\n3/7에서 3 < 7 → 진분수" },
        { question: "6/5은 어떤 분수인가요?",
          display: { type: 'single', num: 6, den: 5 },
          options: ["진분수", "가분수", "단위분수", "자연수"],
          correct: 1, hint: "💡 6 > 5 → 분자가 분모보다 크므로 가분수!" },
        { question: "2/7은 어떤 분수인가요?",
          display: { type: 'single', num: 2, den: 7 },
          options: ["진분수", "가분수", "대분수", "자연수"],
          correct: 0, hint: "💡 2 < 7 → 분자가 분모보다 작으므로 진분수!" },
        { question: "4/4는 어떤 분수인가요?",
          display: { type: 'single', num: 4, den: 4 },
          options: ["진분수", "가분수(=1)", "단위분수", "대분수"],
          correct: 1, hint: "💡 4 = 4 → 분자 ≥ 분모이므로 가분수! 값은 1과 같아요" },
        { question: "진분수의 특징으로 옳은 것은?",
          display: { type: 'text' },
          options: ["분자 > 분모", "분자 = 분모", "분자 < 분모", "분자가 항상 1"],
          correct: 2, hint: "💡 진분수는 항상 분자가 분모보다 작아요 (분자 < 분모)" },
        { question: "가분수의 특징으로 옳은 것은?",
          display: { type: 'text' },
          options: ["분자 < 분모", "분자 ≥ 분모", "분자가 항상 1", "값이 항상 1"],
          correct: 1, hint: "💡 가분수는 분자가 분모보다 크거나 같아요 (분자 ≥ 분모)" },
        { question: "다음 중 가분수가 아닌 것은?",
          display: { type: 'multi', fracs: [{num:8,den:5},{num:7,den:7},{num:3,den:4},{num:11,den:9}] },
          options: ["8/5", "7/7", "3/4", "11/9"],
          correct: 2, hint: "💡 3/4은 3 < 4이므로 진분수예요. 나머지는 모두 가분수!" },
        { question: "1보다 큰 분수는?",
          display: { type: 'multi', fracs: [{num:3,den:4},{num:7,den:6},{num:2,den:5},{num:1,den:3}] },
          options: ["3/4", "7/6", "2/5", "1/3"],
          correct: 1, hint: "💡 분자 > 분모이면 값이 1보다 커요!\n7/6에서 7 > 6 → 1보다 크다" },
        { question: "1보다 작은 분수는?",
          display: { type: 'multi', fracs: [{num:8,den:7},{num:5,den:5},{num:4,den:3},{num:2,den:9}] },
          options: ["8/7", "5/5", "4/3", "2/9"],
          correct: 3, hint: "💡 2/9에서 2 < 9 → 진분수. 값이 1보다 작아요!" },
        { question: "다음 중 진분수를 모두 고른 것은?",
          display: { type: 'multi', fracs: [{num:5,den:3},{num:2,den:5},{num:9,den:9},{num:1,den:4}] },
          options: ["5/3만", "2/5와 1/4", "9/9만", "5/3과 9/9"],
          correct: 1, hint: "💡 2/5: 2<5(진분수), 1/4: 1<4(진분수) → 둘 다 진분수!" },
        { question: "13/10은 어떤 분수인가요?",
          display: { type: 'single', num: 13, den: 10 },
          options: ["진분수", "가분수", "단위분수", "자연수"],
          correct: 1, hint: "💡 13 > 10 → 가분수! 값은 1보다 커요" },
        { question: "분수의 값이 1이 되려면?",
          display: { type: 'text' },
          options: ["분자 > 분모", "분자 < 분모", "분자 = 분모", "분자 = 1"],
          correct: 2, hint: "💡 분자 = 분모이면 값이 1이에요. 예: 5/5 = 1" },
        { question: "다음 분수 중 값이 1인 것은?",
          display: { type: 'multi', fracs: [{num:3,den:5},{num:6,den:6},{num:7,den:8},{num:4,den:5}] },
          options: ["3/5", "6/6", "7/8", "4/5"],
          correct: 1, hint: "💡 분자 = 분모이면 값이 1이에요. 6/6 = 1!" },
        { question: "다음 중 진분수는?",
          display: { type: 'multi', fracs: [{num:6,den:5},{num:3,den:3},{num:5,den:8},{num:10,den:7}] },
          options: ["6/5", "3/3", "5/8", "10/7"],
          correct: 2, hint: "💡 5/8에서 5 < 8 → 진분수!" },
    ],

    // ===================================================
    // 레벨 4: 크기가 같은 분수
    // ===================================================
    4: [
        { question: "1/2과 같은 분수는?",
          display: { type: 'single', num: 1, den: 2 },
          options: ["2/4", "2/5", "3/5", "1/3"],
          correct: 0, hint: "💡 1/2의 분자·분모에 같은 수를 곱하면 크기가 같은 분수!\n1×2 / 2×2 = 2/4" },
        { question: "2/3과 같은 분수는?",
          display: { type: 'single', num: 2, den: 3 },
          options: ["4/9", "4/6", "3/4", "6/8"],
          correct: 1, hint: "💡 2/3의 분자·분모에 2를 곱하면 4/6\n2×2 / 3×2 = 4/6" },
        { question: "3/4과 같은 분수는?",
          display: { type: 'single', num: 3, den: 4 },
          options: ["6/10", "9/12", "6/9", "4/5"],
          correct: 1, hint: "💡 3/4의 분자·분모에 3을 곱하면 9/12\n3×3 / 4×3 = 9/12" },
        { question: "4/6을 약분하면 어떤 분수와 같나요?",
          display: { type: 'single', num: 4, den: 6 },
          options: ["1/2", "2/3", "3/4", "2/4"],
          correct: 1, hint: "💡 4/6의 분자·분모를 2로 나누면 2/3\n4÷2 / 6÷2 = 2/3" },
        { question: "□/6 = 1/3 일 때 □는?",
          display: { type: 'text' },
          options: ["1", "2", "3", "4"],
          correct: 1, hint: "💡 1/3의 분자·분모에 2를 곱하면 2/6\n□ = 2" },
        { question: "1/4 = □/8 일 때 □는?",
          display: { type: 'text' },
          options: ["1", "2", "3", "4"],
          correct: 1, hint: "💡 1/4의 분자·분모에 2를 곱하면 2/8\n□ = 2" },
        { question: "2/5와 같은 분수는?",
          display: { type: 'single', num: 2, den: 5 },
          options: ["4/15", "4/10", "3/10", "6/20"],
          correct: 1, hint: "💡 2/5의 분자·분모에 2를 곱하면 4/10" },
        { question: "6/9을 가장 간단히 나타내면?",
          display: { type: 'single', num: 6, den: 9 },
          options: ["1/2", "2/3", "3/4", "2/4"],
          correct: 1, hint: "💡 6과 9의 최대공약수는 3\n6÷3 / 9÷3 = 2/3" },
        { question: "3/5 = 9/□ 일 때 □는?",
          display: { type: 'text' },
          options: ["10", "12", "15", "20"],
          correct: 2, hint: "💡 3을 9로 만들려면 3을 곱해야 해요\n분모에도 3을 곱하면 5×3 = 15" },
        { question: "8/12와 같은 분수는?",
          display: { type: 'single', num: 8, den: 12 },
          options: ["1/2", "2/3", "3/4", "4/5"],
          correct: 1, hint: "💡 8/12의 분자·분모를 4로 나누면 2/3" },
        { question: "1/3 = □/9 일 때 □는?",
          display: { type: 'text' },
          options: ["2", "3", "4", "6"],
          correct: 1, hint: "💡 1/3의 분자·분모에 3을 곱하면 3/9\n□ = 3" },
        { question: "5/10을 가장 간단히 나타내면?",
          display: { type: 'single', num: 5, den: 10 },
          options: ["1/3", "1/2", "2/5", "3/5"],
          correct: 1, hint: "💡 5/10의 분자·분모를 5로 나누면 1/2" },
        { question: "크기가 같은 분수가 아닌 쌍은?",
          display: { type: 'text' },
          options: ["1/2와 2/4", "2/3와 4/6", "3/4와 6/9", "1/3와 2/6"],
          correct: 2, hint: "💡 3/4의 2배는 6/8. 6/9는 3/4와 크기가 같은 분수가 아니에요!" },
        { question: "4/□ = 2/3 일 때 □는?",
          display: { type: 'text' },
          options: ["4", "6", "8", "12"],
          correct: 1, hint: "💡 2/3의 분자·분모에 2를 곱하면 4/6\n□ = 6" },
        { question: "15/20을 가장 간단히 나타내면?",
          display: { type: 'single', num: 15, den: 20 },
          options: ["1/2", "3/4", "2/3", "4/5"],
          correct: 1, hint: "💡 15와 20의 최대공약수는 5\n15÷5 / 20÷5 = 3/4" },
    ],

    // ===================================================
    // 레벨 5: 약분
    // ===================================================
    5: [
        { question: "6/8을 약분하면?",
          display: { type: 'single', num: 6, den: 8 },
          options: ["3/4", "2/4", "4/6", "1/2"],
          correct: 0, hint: "💡 6과 8의 최대공약수는 2\n6÷2 / 8÷2 = 3/4" },
        { question: "4/10을 약분하면?",
          display: { type: 'single', num: 4, den: 10 },
          options: ["1/5", "2/5", "3/5", "2/4"],
          correct: 1, hint: "💡 4와 10의 최대공약수는 2\n4÷2 / 10÷2 = 2/5" },
        { question: "9/12를 약분하면?",
          display: { type: 'single', num: 9, den: 12 },
          options: ["3/4", "2/3", "4/5", "1/4"],
          correct: 0, hint: "💡 9와 12의 최대공약수는 3\n9÷3 / 12÷3 = 3/4" },
        { question: "6/9을 약분하면?",
          display: { type: 'single', num: 6, den: 9 },
          options: ["1/3", "2/3", "3/4", "1/2"],
          correct: 1, hint: "💡 6과 9의 최대공약수는 3\n6÷3 / 9÷3 = 2/3" },
        { question: "8/12를 약분하면?",
          display: { type: 'single', num: 8, den: 12 },
          options: ["1/2", "2/3", "3/4", "4/6"],
          correct: 1, hint: "💡 8과 12의 최대공약수는 4\n8÷4 / 12÷4 = 2/3" },
        { question: "10/15를 약분하면?",
          display: { type: 'single', num: 10, den: 15 },
          options: ["1/3", "2/3", "2/5", "3/5"],
          correct: 1, hint: "💡 10과 15의 최대공약수는 5\n10÷5 / 15÷5 = 2/3" },
        { question: "더 이상 약분이 안 되는 분수는?",
          display: { type: 'text' },
          options: ["4/8", "6/9", "5/7", "3/6"],
          correct: 2, hint: "💡 5와 7의 공약수는 1뿐이므로 약분이 안 돼요!" },
        { question: "12/16을 약분하면?",
          display: { type: 'single', num: 12, den: 16 },
          options: ["3/4", "2/3", "4/5", "6/8"],
          correct: 0, hint: "💡 12와 16의 최대공약수는 4\n12÷4 / 16÷4 = 3/4" },
        { question: "14/21을 약분하면?",
          display: { type: 'single', num: 14, den: 21 },
          options: ["1/3", "2/3", "2/7", "7/9"],
          correct: 1, hint: "💡 14와 21의 최대공약수는 7\n14÷7 / 21÷7 = 2/3" },
        { question: "약분할 수 없는 분수는?",
          display: { type: 'text' },
          options: ["4/6", "7/10", "9/12", "6/8"],
          correct: 1, hint: "💡 7과 10의 공약수는 1뿐. 약분이 안 돼요!" },
        { question: "8/20을 약분하면?",
          display: { type: 'single', num: 8, den: 20 },
          options: ["1/4", "2/5", "4/10", "1/3"],
          correct: 1, hint: "💡 8과 20의 최대공약수는 4\n8÷4 / 20÷4 = 2/5" },
        { question: "6/10을 약분하면?",
          display: { type: 'single', num: 6, den: 10 },
          options: ["1/2", "2/3", "3/5", "3/4"],
          correct: 2, hint: "💡 6과 10의 최대공약수는 2\n6÷2 / 10÷2 = 3/5" },
        { question: "21/28을 약분하면?",
          display: { type: 'single', num: 21, den: 28 },
          options: ["2/3", "3/4", "5/7", "7/9"],
          correct: 1, hint: "💡 21과 28의 최대공약수는 7\n21÷7 / 28÷7 = 3/4" },
        { question: "18/24를 약분하면?",
          display: { type: 'single', num: 18, den: 24 },
          options: ["2/3", "3/4", "4/5", "5/6"],
          correct: 1, hint: "💡 18과 24의 최대공약수는 6\n18÷6 / 24÷6 = 3/4" },
        { question: "약분이란 무엇인가요?",
          display: { type: 'text' },
          options: ["분자·분모에 같은 수 곱하기", "분자·분모를 공약수로 나누기", "분수끼리 더하기", "두 분수를 같게 만들기"],
          correct: 1, hint: "💡 약분은 분자·분모를 공약수로 나눠서 간단하게 만드는 것이에요!" },
    ],

    // ===================================================
    // 레벨 6: 공배수
    // ===================================================
    6: [
        { question: "다음 중 3과 4의 공배수는?",
          display: { type: 'text' },
          options: ["8", "9", "12", "10"],
          correct: 2, hint: "💡 3의 배수: 3,6,9,12...\n4의 배수: 4,8,12...\n둘 다에 있는 12가 공배수!" },
        { question: "다음 중 2와 5의 공배수는?",
          display: { type: 'text' },
          options: ["8", "15", "20", "14"],
          correct: 2, hint: "💡 2의 배수: 2,4,6,8,10,20...\n5의 배수: 5,10,15,20...\n20은 두 수의 공배수!" },
        { question: "4와 6의 공배수가 아닌 것은?",
          display: { type: 'text' },
          options: ["12", "24", "18", "36"],
          correct: 2, hint: "💡 18은 6의 배수지만 4의 배수는 아니에요!\n18÷4 = 나머지 2" },
        { question: "다음 중 2와 3의 공배수는?",
          display: { type: 'text' },
          options: ["4", "9", "12", "8"],
          correct: 2, hint: "💡 2의 배수: 2,4,6,8,10,12...\n3의 배수: 3,6,9,12...\n12가 공배수!" },
        { question: "6과 8의 공배수는?",
          display: { type: 'text' },
          options: ["12", "16", "24", "20"],
          correct: 2, hint: "💡 6의 배수: 6,12,18,24...\n8의 배수: 8,16,24...\n24가 공배수!" },
        { question: "4의 배수이면서 6의 배수인 수는?",
          display: { type: 'text' },
          options: ["8", "18", "24", "16"],
          correct: 2, hint: "💡 4의 배수: 4,8,12,16,20,24...\n6의 배수: 6,12,18,24...\n24가 공배수!" },
        { question: "5와 7의 공배수는?",
          display: { type: 'text' },
          options: ["25", "35", "42", "28"],
          correct: 1, hint: "💡 5의 배수: 5,10,15,20,25,30,35...\n7의 배수: 7,14,21,28,35...\n35가 공배수!" },
        { question: "다음 중 4와 10의 공배수는?",
          display: { type: 'text' },
          options: ["8", "10", "20", "16"],
          correct: 2, hint: "💡 4의 배수: 4,8,12,16,20...\n10의 배수: 10,20,30...\n20이 공배수!" },
        { question: "3과 8의 공배수가 아닌 것은?",
          display: { type: 'text' },
          options: ["24", "48", "72", "16"],
          correct: 3, hint: "💡 16은 8의 배수이지만 3의 배수가 아니에요!\n16÷3 = 나머지 1" },
        { question: "4와 6의 공배수 중 가장 작은 수는?",
          display: { type: 'text' },
          options: ["6", "8", "12", "24"],
          correct: 2, hint: "💡 4의 배수: 4,8,12...\n6의 배수: 6,12...\n가장 작은 공배수(최소공배수)는 12!" },
        { question: "2와 9의 공배수는?",
          display: { type: 'text' },
          options: ["12", "18", "27", "16"],
          correct: 1, hint: "💡 2와 9의 공배수: 18, 36, 54...\n18 = 2×9가 첫 번째 공배수!" },
        { question: "5와 6의 공배수는?",
          display: { type: 'text' },
          options: ["15", "30", "24", "20"],
          correct: 1, hint: "💡 5의 배수: 5,10,15,20,25,30...\n6의 배수: 6,12,18,24,30...\n30이 공배수!" },
        { question: "3과 4의 공배수 중 세 번째로 작은 수는?",
          display: { type: 'text' },
          options: ["12", "24", "36", "48"],
          correct: 2, hint: "💡 3과 4의 공배수: 12, 24, 36, 48...\n세 번째는 36!" },
        { question: "공배수란 무엇인가요?",
          display: { type: 'text' },
          options: ["한 수의 배수", "두 수의 공통인 배수", "두 수의 합", "두 수의 차"],
          correct: 1, hint: "💡 공배수는 두 수의 배수 중 공통으로 있는 수예요!" },
        { question: "2, 3, 4 세 수의 공배수는?",
          display: { type: 'text' },
          options: ["6", "8", "12", "10"],
          correct: 2, hint: "💡 세 수의 배수 모두인 수: 12\n12 = 2×6 = 3×4 = 4×3" },
    ],

    // ===================================================
    // 레벨 7: 최소공배수
    // ===================================================
    7: [
        { question: "4와 6의 최소공배수는?",
          display: { type: 'text' },
          options: ["12", "18", "24", "6"],
          correct: 0, hint: "💡 4의 배수: 4,8,12...\n6의 배수: 6,12...\n처음 만나는 공배수 = 최소공배수 = 12" },
        { question: "3과 5의 최소공배수는?",
          display: { type: 'text' },
          options: ["8", "10", "15", "30"],
          correct: 2, hint: "💡 3의 배수: 3,6,9,12,15\n5의 배수: 5,10,15\n최소공배수 = 15" },
        { question: "2와 7의 최소공배수는?",
          display: { type: 'text' },
          options: ["7", "9", "14", "21"],
          correct: 2, hint: "💡 2와 7은 서로소(공약수가 1뿐)\n최소공배수 = 2×7 = 14" },
        { question: "6과 9의 최소공배수는?",
          display: { type: 'text' },
          options: ["18", "27", "36", "54"],
          correct: 0, hint: "💡 6의 배수: 6,12,18\n9의 배수: 9,18\n최소공배수 = 18" },
        { question: "4와 5의 최소공배수는?",
          display: { type: 'text' },
          options: ["10", "15", "20", "40"],
          correct: 2, hint: "💡 4와 5는 서로소\n최소공배수 = 4×5 = 20" },
        { question: "3과 4의 최소공배수는?",
          display: { type: 'text' },
          options: ["7", "8", "12", "24"],
          correct: 2, hint: "💡 3과 4는 서로소\n최소공배수 = 3×4 = 12" },
        { question: "8과 12의 최소공배수는?",
          display: { type: 'text' },
          options: ["16", "24", "36", "96"],
          correct: 1, hint: "💡 8의 배수: 8,16,24\n12의 배수: 12,24\n최소공배수 = 24" },
        { question: "5와 8의 최소공배수는?",
          display: { type: 'text' },
          options: ["20", "30", "40", "80"],
          correct: 2, hint: "💡 5와 8은 서로소\n최소공배수 = 5×8 = 40" },
        { question: "2와 3의 최소공배수는?",
          display: { type: 'text' },
          options: ["4", "6", "9", "12"],
          correct: 1, hint: "💡 2의 배수: 2,4,6\n3의 배수: 3,6\n최소공배수 = 6" },
        { question: "6과 10의 최소공배수는?",
          display: { type: 'text' },
          options: ["20", "30", "40", "60"],
          correct: 1, hint: "💡 6의 배수: 6,12,18,24,30\n10의 배수: 10,20,30\n최소공배수 = 30" },
        { question: "4와 9의 최소공배수는?",
          display: { type: 'text' },
          options: ["18", "27", "36", "72"],
          correct: 2, hint: "💡 4와 9는 서로소\n최소공배수 = 4×9 = 36" },
        { question: "10과 15의 최소공배수는?",
          display: { type: 'text' },
          options: ["20", "30", "40", "150"],
          correct: 1, hint: "💡 10의 배수: 10,20,30\n15의 배수: 15,30\n최소공배수 = 30" },
        { question: "3과 7의 최소공배수는?",
          display: { type: 'text' },
          options: ["10", "14", "21", "42"],
          correct: 2, hint: "💡 3과 7은 서로소\n최소공배수 = 3×7 = 21" },
        { question: "최소공배수에 대한 설명으로 옳은 것은?",
          display: { type: 'text' },
          options: ["공배수 중 가장 큰 수", "공배수 중 가장 작은 수", "두 수의 합", "두 수의 차"],
          correct: 1, hint: "💡 최소공배수는 공배수 중에서 가장 작은 수예요!" },
        { question: "12와 18의 최소공배수는?",
          display: { type: 'text' },
          options: ["24", "36", "54", "216"],
          correct: 1, hint: "💡 12의 배수: 12,24,36\n18의 배수: 18,36\n최소공배수 = 36" },
    ],

    // ===================================================
    // 레벨 8: 통분
    // ===================================================
    8: [
        { question: "1/3과 1/4를 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:3}, frac2:{num:1,den:4} },
          options: ["4/12와 3/12", "3/12와 1/12", "1/12와 1/12", "3/9와 4/16"],
          correct: 0, hint: "💡 3과 4의 최소공배수는 12\n1/3 = 4/12, 1/4 = 3/12" },
        { question: "1/2와 1/3을 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:2}, frac2:{num:1,den:3} },
          options: ["3/6와 2/6", "2/6와 1/6", "1/6와 1/6", "2/4와 2/6"],
          correct: 0, hint: "💡 2와 3의 최소공배수는 6\n1/2 = 3/6, 1/3 = 2/6" },
        { question: "1/4와 1/6을 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:4}, frac2:{num:1,den:6} },
          options: ["3/12와 2/12", "2/8와 2/12", "1/12와 1/12", "4/16와 4/24"],
          correct: 0, hint: "💡 4와 6의 최소공배수는 12\n1/4 = 3/12, 1/6 = 2/12" },
        { question: "2/3와 3/4를 통분하면?",
          display: { type: 'pair', frac1:{num:2,den:3}, frac2:{num:3,den:4} },
          options: ["8/12와 9/12", "6/12와 9/12", "8/12와 6/12", "4/6와 6/8"],
          correct: 0, hint: "💡 3과 4의 최소공배수는 12\n2/3 = 8/12, 3/4 = 9/12" },
        { question: "1/2와 2/5를 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:2}, frac2:{num:2,den:5} },
          options: ["5/10와 4/10", "2/10와 4/10", "5/10와 2/10", "3/10와 4/10"],
          correct: 0, hint: "💡 2와 5의 최소공배수는 10\n1/2 = 5/10, 2/5 = 4/10" },
        { question: "통분할 때 공통 분모는?",
          display: { type: 'text' },
          options: ["두 분모의 합", "두 분모의 차", "두 분모의 최소공배수", "두 분모의 최대공약수"],
          correct: 2, hint: "💡 통분할 때는 두 분모의 최소공배수를 공통 분모로 써요!" },
        { question: "1/3와 1/5를 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:3}, frac2:{num:1,den:5} },
          options: ["5/15와 3/15", "3/15와 1/15", "1/15와 1/15", "2/6와 2/10"],
          correct: 0, hint: "💡 3과 5의 최소공배수는 15\n1/3 = 5/15, 1/5 = 3/15" },
        { question: "3/4와 5/6을 통분하면?",
          display: { type: 'pair', frac1:{num:3,den:4}, frac2:{num:5,den:6} },
          options: ["9/12와 10/12", "12/16와 10/12", "3/12와 5/12", "6/8와 10/12"],
          correct: 0, hint: "💡 4와 6의 최소공배수는 12\n3/4 = 9/12, 5/6 = 10/12" },
        { question: "2/5와 1/4를 통분하면?",
          display: { type: 'pair', frac1:{num:2,den:5}, frac2:{num:1,den:4} },
          options: ["8/20와 5/20", "4/10와 2/8", "8/20와 4/20", "2/20와 5/20"],
          correct: 0, hint: "💡 5와 4의 최소공배수는 20\n2/5 = 8/20, 1/4 = 5/20" },
        { question: "1/6과 1/4를 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:6}, frac2:{num:1,den:4} },
          options: ["2/12와 3/12", "1/12와 1/12", "4/24와 6/24", "1/12와 3/12"],
          correct: 0, hint: "💡 6과 4의 최소공배수는 12\n1/6 = 2/12, 1/4 = 3/12" },
        { question: "1/2와 1/4를 통분하면?",
          display: { type: 'pair', frac1:{num:1,den:2}, frac2:{num:1,den:4} },
          options: ["2/4와 1/4", "4/8와 2/8", "1/4와 2/4", "3/4와 1/4"],
          correct: 0, hint: "💡 2와 4의 최소공배수는 4\n1/2 = 2/4, 1/4 = 1/4" },
        { question: "5/6과 2/9를 통분하면?",
          display: { type: 'pair', frac1:{num:5,den:6}, frac2:{num:2,den:9} },
          options: ["15/18와 4/18", "10/18와 4/18", "15/18와 2/18", "5/18와 4/18"],
          correct: 0, hint: "💡 6과 9의 최소공배수는 18\n5/6 = 15/18, 2/9 = 4/18" },
        { question: "통분이 필요하지 않은 경우는?",
          display: { type: 'text' },
          options: ["1/3 + 1/4", "2/5 + 1/5", "3/4 + 1/6", "1/2 + 1/7"],
          correct: 1, hint: "💡 2/5와 1/5는 분모가 이미 5로 같아서 통분이 필요 없어요!" },
        { question: "3/5과 7/10을 통분하면?",
          display: { type: 'pair', frac1:{num:3,den:5}, frac2:{num:7,den:10} },
          options: ["6/10와 7/10", "3/10와 7/10", "6/15와 7/15", "9/15와 7/10"],
          correct: 0, hint: "💡 5와 10의 최소공배수는 10\n3/5 = 6/10, 7/10 = 7/10" },
        { question: "통분의 목적은 무엇인가요?",
          display: { type: 'text' },
          options: ["분수를 간단하게 만들기", "분모를 같게 만들기", "분자를 1로 만들기", "분수를 자연수로 만들기"],
          correct: 1, hint: "💡 통분은 두 분수의 분모를 같게 만드는 것이에요!" },
    ],

    // ===================================================
    // 레벨 9: 분수 크기 비교
    // ===================================================
    9: [
        { question: "어느 분수가 더 큰가요?",
          display: { type: 'compare', frac1:{num:3,den:5}, frac2:{num:4,den:7} },
          options: ["3/5", "4/7", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 35):\n3/5 = 21/35, 4/7 = 20/35\n21 > 20이므로 3/5 > 4/7" },
        { question: "어느 분수가 더 큰가요?",
          display: { type: 'compare', frac1:{num:2,den:3}, frac2:{num:3,den:4} },
          options: ["2/3", "3/4", "같다", "알 수 없다"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n2/3 = 8/12, 3/4 = 9/12\n8 < 9이므로 3/4가 더 커요" },
        { question: "어느 분수가 더 작은가요?",
          display: { type: 'compare', frac1:{num:1,den:3}, frac2:{num:2,den:7} },
          options: ["1/3", "2/7", "같다", "알 수 없다"],
          correct: 1, hint: "💡 통분 (공통분모 21):\n1/3 = 7/21, 2/7 = 6/21\n6 < 7이므로 2/7이 더 작아요" },
        { question: "어느 분수가 더 큰가요?",
          display: { type: 'compare', frac1:{num:5,den:6}, frac2:{num:7,den:9} },
          options: ["5/6", "7/9", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 18):\n5/6 = 15/18, 7/9 = 14/18\n15 > 14이므로 5/6 > 7/9" },
        { question: "3개 중 가장 큰 분수는?",
          display: { type: 'multi', fracs: [{num:2,den:3},{num:3,den:5},{num:4,den:7}] },
          options: ["2/3", "3/5", "4/7", "모두 같다"],
          correct: 0, hint: "💡 통분 (공통분모 105):\n2/3=70/105, 3/5=63/105, 4/7=60/105\n2/3이 가장 커요!" },
        { question: "1/2와 3/7 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:1,den:2}, frac2:{num:3,den:7} },
          options: ["1/2", "3/7", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 14):\n1/2 = 7/14, 3/7 = 6/14\n7 > 6이므로 1/2 > 3/7" },
        { question: "4/5와 5/6 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:4,den:5}, frac2:{num:5,den:6} },
          options: ["4/5", "5/6", "같다", "알 수 없다"],
          correct: 1, hint: "💡 통분 (공통분모 30):\n4/5 = 24/30, 5/6 = 25/30\n24 < 25이므로 5/6이 더 커요" },
        { question: "3/4와 5/8 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:3,den:4}, frac2:{num:5,den:8} },
          options: ["3/4", "5/8", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 8):\n3/4 = 6/8, 5/8 = 5/8\n6 > 5이므로 3/4 > 5/8" },
        { question: "분모가 다른 분수를 비교할 때 필요한 것은?",
          display: { type: 'text' },
          options: ["약분", "통분", "약수 구하기", "배수 구하기"],
          correct: 1, hint: "💡 분모가 다른 분수를 비교하려면 먼저 통분이 필요해요!" },
        { question: "7/8과 5/6 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:7,den:8}, frac2:{num:5,den:6} },
          options: ["7/8", "5/6", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 24):\n7/8 = 21/24, 5/6 = 20/24\n21 > 20이므로 7/8 > 5/6" },
        { question: "1/3과 2/5 중 더 작은 수는?",
          display: { type: 'compare', frac1:{num:1,den:3}, frac2:{num:2,den:5} },
          options: ["1/3", "2/5", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 15):\n1/3 = 5/15, 2/5 = 6/15\n5 < 6이므로 1/3이 더 작아요" },
        { question: "3개 중 가장 작은 분수는?",
          display: { type: 'multi', fracs: [{num:1,den:2},{num:3,den:7},{num:4,den:9}] },
          options: ["1/2", "3/7", "4/9", "모두 같다"],
          correct: 2, hint: "💡 통분 (공통분모 126):\n1/2=63/126, 3/7=54/126, 4/9=56/126\n54이 가장 작으므로 3/7 가장 작아요!" },
        { question: "5/12와 3/8 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:5,den:12}, frac2:{num:3,den:8} },
          options: ["5/12", "3/8", "같다", "알 수 없다"],
          correct: 0, hint: "💡 통분 (공통분모 24):\n5/12 = 10/24, 3/8 = 9/24\n10 > 9이므로 5/12 > 3/8" },
        { question: "2/9와 3/13 중 더 큰 수는?",
          display: { type: 'compare', frac1:{num:2,den:9}, frac2:{num:3,den:13} },
          options: ["2/9", "3/13", "같다", "알 수 없다"],
          correct: 1, hint: "💡 교차 곱셈: 2×13 = 26, 3×9 = 27\n26 < 27이므로 3/13 > 2/9" },
        { question: "2/3와 3/5 중 1에 더 가까운 수는?",
          display: { type: 'compare', frac1:{num:2,den:3}, frac2:{num:3,den:5} },
          options: ["2/3", "3/5", "같다", "알 수 없다"],
          correct: 0, hint: "💡 1에서 뺀 값: 1-2/3=1/3, 1-3/5=2/5\n통분: 1/3=5/15, 2/5=6/15\n1/3 < 2/5이므로 2/3가 1에 더 가까워요!" },
    ],

    // ===================================================
    // 레벨 10: 분수의 덧셈
    // ===================================================
    10: [
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/3 + 1/4', frac1:{num:1,den:3}, op:'+', frac2:{num:1,den:4} },
          options: ["7/12", "2/7", "1/6", "5/12"],
          correct: 0, hint: "💡 통분 (공통분모 12):\n1/3 = 4/12, 1/4 = 3/12\n4/12 + 3/12 = 7/12" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/2 + 1/3', frac1:{num:1,den:2}, op:'+', frac2:{num:1,den:3} },
          options: ["2/5", "5/6", "2/6", "3/5"],
          correct: 1, hint: "💡 통분 (공통분모 6):\n1/2 = 3/6, 1/3 = 2/6\n3/6 + 2/6 = 5/6" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '2/3 + 1/4', frac1:{num:2,den:3}, op:'+', frac2:{num:1,den:4} },
          options: ["3/7", "11/12", "3/12", "8/12"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n2/3 = 8/12, 1/4 = 3/12\n8/12 + 3/12 = 11/12" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/2 + 1/4', frac1:{num:1,den:2}, op:'+', frac2:{num:1,den:4} },
          options: ["2/6", "3/4", "1/4", "2/4"],
          correct: 1, hint: "💡 통분 (공통분모 4):\n1/2 = 2/4, 1/4 = 1/4\n2/4 + 1/4 = 3/4" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/3 + 1/5', frac1:{num:1,den:3}, op:'+', frac2:{num:1,den:5} },
          options: ["2/8", "8/15", "2/15", "5/15"],
          correct: 1, hint: "💡 통분 (공통분모 15):\n1/3 = 5/15, 1/5 = 3/15\n5/15 + 3/15 = 8/15" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/4 + 1/8', frac1:{num:3,den:4}, op:'+', frac2:{num:1,den:8} },
          options: ["4/8", "7/8", "4/12", "1/2"],
          correct: 1, hint: "💡 통분 (공통분모 8):\n3/4 = 6/8, 1/8 = 1/8\n6/8 + 1/8 = 7/8" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '2/5 + 1/3', frac1:{num:2,den:5}, op:'+', frac2:{num:1,den:3} },
          options: ["3/8", "11/15", "3/15", "7/15"],
          correct: 1, hint: "💡 통분 (공통분모 15):\n2/5 = 6/15, 1/3 = 5/15\n6/15 + 5/15 = 11/15" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/4 + 3/8', frac1:{num:1,den:4}, op:'+', frac2:{num:3,den:8} },
          options: ["4/12", "5/8", "4/8", "1/8"],
          correct: 1, hint: "💡 통분 (공통분모 8):\n1/4 = 2/8, 3/8 = 3/8\n2/8 + 3/8 = 5/8" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/6 + 1/4', frac1:{num:1,den:6}, op:'+', frac2:{num:1,den:4} },
          options: ["2/10", "5/12", "2/12", "1/12"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n1/6 = 2/12, 1/4 = 3/12\n2/12 + 3/12 = 5/12" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/5 + 1/4', frac1:{num:3,den:5}, op:'+', frac2:{num:1,den:4} },
          options: ["4/9", "17/20", "4/20", "12/20"],
          correct: 1, hint: "💡 통분 (공통분모 20):\n3/5 = 12/20, 1/4 = 5/20\n12/20 + 5/20 = 17/20" },
        { question: "분모가 다른 분수를 더할 때 먼저 해야 할 것은?",
          display: { type: 'text' },
          options: ["약분", "통분", "분자끼리 더하기", "분모끼리 더하기"],
          correct: 1, hint: "💡 분모가 다른 분수를 더할 때는 먼저 통분이 필요해요!" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/2 + 2/7', frac1:{num:1,den:2}, op:'+', frac2:{num:2,den:7} },
          options: ["3/9", "11/14", "3/14", "9/14"],
          correct: 1, hint: "💡 통분 (공통분모 14):\n1/2 = 7/14, 2/7 = 4/14\n7/14 + 4/14 = 11/14" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '5/6 + 1/4', frac1:{num:5,den:6}, op:'+', frac2:{num:1,den:4} },
          options: ["6/10", "13/12", "10/12", "6/24"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n5/6 = 10/12, 1/4 = 3/12\n10/12 + 3/12 = 13/12" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '2/3 + 3/5', frac1:{num:2,den:3}, op:'+', frac2:{num:3,den:5} },
          options: ["5/8", "19/15", "10/15", "5/15"],
          correct: 1, hint: "💡 통분 (공통분모 15):\n2/3 = 10/15, 3/5 = 9/15\n10/15 + 9/15 = 19/15" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/8 + 1/6', frac1:{num:3,den:8}, op:'+', frac2:{num:1,den:6} },
          options: ["4/14", "13/24", "4/24", "9/24"],
          correct: 1, hint: "💡 통분 (공통분모 24):\n3/8 = 9/24, 1/6 = 4/24\n9/24 + 4/24 = 13/24" },
    ],

    // ===================================================
    // 레벨 11: 분수의 뺄셈
    // ===================================================
    11: [
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/2 - 1/3', frac1:{num:1,den:2}, op:'-', frac2:{num:1,den:3} },
          options: ["1/6", "0", "2/5", "1/5"],
          correct: 0, hint: "💡 통분 (공통분모 6):\n1/2 = 3/6, 1/3 = 2/6\n3/6 - 2/6 = 1/6" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/4 - 1/2', frac1:{num:3,den:4}, op:'-', frac2:{num:1,den:2} },
          options: ["2/2", "1/4", "2/4", "1/2"],
          correct: 1, hint: "💡 통분 (공통분모 4):\n3/4 = 3/4, 1/2 = 2/4\n3/4 - 2/4 = 1/4" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '5/6 - 1/3', frac1:{num:5,den:6}, op:'-', frac2:{num:1,den:3} },
          options: ["4/3", "1/2", "2/3", "4/6"],
          correct: 1, hint: "💡 통분 (공통분모 6):\n5/6 = 5/6, 1/3 = 2/6\n5/6 - 2/6 = 3/6 = 1/2" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '7/8 - 3/4', frac1:{num:7,den:8}, op:'-', frac2:{num:3,den:4} },
          options: ["4/4", "1/8", "4/8", "1/4"],
          correct: 1, hint: "💡 통분 (공통분모 8):\n7/8 = 7/8, 3/4 = 6/8\n7/8 - 6/8 = 1/8" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '2/3 - 1/4', frac1:{num:2,den:3}, op:'-', frac2:{num:1,den:4} },
          options: ["1/7", "5/12", "1/12", "8/12"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n2/3 = 8/12, 1/4 = 3/12\n8/12 - 3/12 = 5/12" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/5 - 1/3', frac1:{num:3,den:5}, op:'-', frac2:{num:1,den:3} },
          options: ["2/2", "4/15", "2/15", "9/15"],
          correct: 1, hint: "💡 통분 (공통분모 15):\n3/5 = 9/15, 1/3 = 5/15\n9/15 - 5/15 = 4/15" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '1/2 - 1/5', frac1:{num:1,den:2}, op:'-', frac2:{num:1,den:5} },
          options: ["0", "3/10", "1/3", "2/7"],
          correct: 1, hint: "💡 통분 (공통분모 10):\n1/2 = 5/10, 1/5 = 2/10\n5/10 - 2/10 = 3/10" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '5/6 - 3/4', frac1:{num:5,den:6}, op:'-', frac2:{num:3,den:4} },
          options: ["2/2", "1/12", "2/3", "8/12"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n5/6 = 10/12, 3/4 = 9/12\n10/12 - 9/12 = 1/12" },
        { question: "분모가 다른 분수를 뺄 때 먼저 해야 할 것은?",
          display: { type: 'text' },
          options: ["약분", "통분", "분자끼리 빼기", "분모끼리 빼기"],
          correct: 1, hint: "💡 분모가 다른 분수를 뺄 때는 먼저 통분이 필요해요!" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '4/5 - 1/3', frac1:{num:4,den:5}, op:'-', frac2:{num:1,den:3} },
          options: ["3/2", "7/15", "3/15", "12/15"],
          correct: 1, hint: "💡 통분 (공통분모 15):\n4/5 = 12/15, 1/3 = 5/15\n12/15 - 5/15 = 7/15" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '7/10 - 2/5', frac1:{num:7,den:10}, op:'-', frac2:{num:2,den:5} },
          options: ["5/5", "3/10", "1/2", "5/10"],
          correct: 1, hint: "💡 통분 (공통분모 10):\n7/10 = 7/10, 2/5 = 4/10\n7/10 - 4/10 = 3/10" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '3/4 - 5/12', frac1:{num:3,den:4}, op:'-', frac2:{num:5,den:12} },
          options: ["1/3", "5/12", "1/6", "2/12"],
          correct: 0, hint: "💡 통분 (공통분모 12):\n3/4 = 9/12, 5/12 = 5/12\n9/12 - 5/12 = 4/12 = 1/3" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '5/8 - 1/4', frac1:{num:5,den:8}, op:'-', frac2:{num:1,den:4} },
          options: ["4/4", "3/8", "4/8", "1/4"],
          correct: 1, hint: "💡 통분 (공통분모 8):\n5/8 = 5/8, 1/4 = 2/8\n5/8 - 2/8 = 3/8" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '11/12 - 3/4', frac1:{num:11,den:12}, op:'-', frac2:{num:3,den:4} },
          options: ["8/8", "1/6", "2/12", "8/12"],
          correct: 1, hint: "💡 통분 (공통분모 12):\n11/12 = 11/12, 3/4 = 9/12\n11/12 - 9/12 = 2/12 = 1/6" },
        { question: "계산하세요",
          display: { type: 'calc', expr: '2/3 - 3/8', frac1:{num:2,den:3}, op:'-', frac2:{num:3,den:8} },
          options: ["1/5", "7/24", "1/24", "16/24"],
          correct: 1, hint: "💡 통분 (공통분모 24):\n2/3 = 16/24, 3/8 = 9/24\n16/24 - 9/24 = 7/24" },
    ],
};

// ─────────────────────────────────────────────────────────
// 문제 선택 함수 (외부에서 호출)
// ─────────────────────────────────────────────────────────

/**
 * 특정 레벨에서 무작위로 n개의 문제를 선택합니다.
 * @param {number} level  레벨 번호 (1~11)
 * @param {number} count  선택할 문제 수 (기본값: 10)
 * @returns {Array} 선택된 문제 배열
 */
function getQuestions(level, count = 10) {
    const pool = QUESTION_POOL[level];
    if (!pool) return [];
    return shuffleArray(pool)
        .slice(0, Math.min(count, pool.length))
        .map(withShuffledOptions);
}

/**
 * 이미 사용된 문제를 제외하고 유사 문제(대체 문제)를 반환합니다.
 * @param {number} level         레벨 번호
 * @param {Array}  usedQuestions 이미 사용된 문제 배열
 * @returns {Object|null} 대체 문제 또는 null
 */
function getSimilarQuestion(level, usedQuestions) {
    const pool = QUESTION_POOL[level];
    if (!pool) return null;
    // 사용된 문제는 보기가 섞인 사본이므로, 원본(_orig) 기준으로 중복을 거른다
    const usedOrigs = new Set((usedQuestions || []).map(q => (q && q._orig) || q));
    const available = pool.filter(q => !usedOrigs.has(q));
    const base = available.length === 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : available[Math.floor(Math.random() * available.length)];
    return withShuffledOptions(base);
}
