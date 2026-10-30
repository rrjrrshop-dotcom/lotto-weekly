import './style.css';
import confetti from 'canvas-confetti';
import {
  getLottoState,
  generateWeeklyGames,
  getBallColorInfo,
  RECENT_ROUNDS,
  evaluateTicket
} from './lottoEngine.js';

// 애플리케이션 상태
let currentTab = 'analysis';
let selectedRound = null;
let customInputs = ['', '', '', '', '', ''];

// 토스트 메시지 함수
function showToast(message, icon = '✨') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// 로또 공 HTML 렌더러
function renderBall(num, isBonus = false) {
  const color = getBallColorInfo(num);
  const padNum = String(num).padStart(2, '0');
  const bonusClass = isBonus ? 'ball-bonus' : '';
  return `<div class="lotto-ball ball-${color.bg} ${bonusClass}" title="${num}번 (${color.label})">${padNum}</div>`;
}

// 렌더링 메인 함수
function renderApp() {
  const app = document.getElementById('app');
  const state = getLottoState();
  const activeRound = selectedRound || state.targetRound;
  const isCurrentActiveRound = activeRound === state.targetRound;
  const games = generateWeeklyGames(activeRound);

  // 날짜 포맷팅
  const fmtDate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${['일','월','화','수','목','금','토'][d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const isDrawing = state.status === 'DRAWING' && isCurrentActiveRound;

  app.innerHTML = `
    <!-- 상단 헤더 -->
    <header class="header">
      <div class="trust-badge">
        <span class="dot"></span>
        <span>주간 고정 보증 시스템 가동 중</span>
      </div>
      <h1 class="brand-title">
        <span class="logo-ball">7</span>
        LottoGolden 6/45
      </h1>
      <p class="brand-subtitle">
        매주 <strong>토요일 오후 9시</strong>부터 <strong>다음 주 토요일 오후 8시</strong>까지 1주일간 절대 변하지 않는 신뢰의 5대 골든 조합
      </p>
    </header>

    <!-- 주간 고정 타이머 & 상태 카드 -->
    <section class="timelock-card">
      <div class="timelock-header">
        <div class="round-info">
          <div class="round-pill">제 ${activeRound} 회차</div>
          <div class="status-badge ${isDrawing ? 'drawing' : 'active'}">
            ${isDrawing 
              ? '⏳ [추첨 및 집계 진행 중]' 
              : '🔒 [1주일 번호 동결 유지 중]'}
          </div>
        </div>

        <div class="countdown-container">
          <div class="countdown-label">
            ${isDrawing ? '차기 회차 오픈까지' : '판매 마감 및 추첨까지'}
          </div>
          <div class="countdown-units" id="countdown-units">
            <!-- JS 타이머로 초단위 갱신 -->
          </div>
        </div>
      </div>

      <div class="timelock-notice">
        <div>
          <span>유지 기간: </span>
          <strong>${fmtDate(state.cycleStart)}</strong> ~ <strong>${fmtDate(state.cycleCutoff)} KST</strong>
        </div>
        <button class="rule-info-btn" id="open-rule-modal-btn">
          <span>ℹ️ 고정 원칙 보기</span>
        </button>
      </div>
    </section>

    <!-- 액션 바 -->
    <div class="actions-bar">
      <div class="section-heading">
        <span>금주의 5개 골든 조합</span>
        <span class="badge">A ~ E Game</span>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="copy-all-btn">
          <span>📋 5게임 일괄 복사</span>
        </button>
        <button class="btn btn-secondary" id="open-slip-modal-btn">
          <span>🧾 실물 복권 슬립 보기</span>
        </button>
      </div>
    </div>

    <!-- 5개 게임 리스트 -->
    <section class="games-grid">
      ${games.map((game) => `
        <div class="game-card" data-game-id="${game.id}">
          <div class="game-card-left">
            <div class="game-letter">${game.id}</div>
            <div class="game-meta">
              <h4>${game.title}</h4>
              <p>${game.subtitle}</p>
            </div>
          </div>

          <div class="balls-row">
            ${game.numbers.map((n) => renderBall(n)).join('')}
          </div>

          <div class="game-card-right">
            <div class="stat-pills">
              <span class="stat-pill">합계 ${game.stats.sum}</span>
              <span class="stat-pill">홀짝 ${game.stats.oddCount}:${game.stats.evenCount}</span>
              ${game.tags.map(t => `<span class="stat-pill">${t}</span>`).join('')}
            </div>
            <button class="btn-icon copy-game-btn" data-game="${game.id}" data-numbers="${game.numbers.join(', ')}" title="이 게임 번호 복사">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      `).join('')}
    </section>

    <!-- 통계 및 보조 기능 탭 네비게이션 -->
    <nav class="tabs-nav">
      <button class="tab-btn ${currentTab === 'analysis' ? 'active' : ''}" data-tab="analysis">
        📊 심층 통계 분석
      </button>
      <button class="tab-btn ${currentTab === 'checker' ? 'active' : ''}" data-tab="checker">
        🎯 번호 채점기 & 직전 당첨 확인
      </button>
      <button class="tab-btn ${currentTab === 'history' ? 'active' : ''}" data-tab="history">
        📜 회차별 타임머신 (투명성 검증)
      </button>
    </nav>

    <!-- 탭 1: 심층 통계 분석 -->
    <div class="tab-content ${currentTab === 'analysis' ? 'active' : ''}" id="tab-analysis">
      <div class="analysis-grid">
        <div class="analysis-card">
          <h5>🎨 번호 대역별(색상) 5대 분포율</h5>
          ${renderDecileBars(games)}
        </div>

        <div class="analysis-card">
          <h5>⚖️ 홀수 / 짝수 밸런스 비율</h5>
          ${renderOddEvenSummary(games)}
        </div>

        <div class="analysis-card">
          <h5>📈 번호 총합(Sum) 분포 구간</h5>
          ${renderSumDistribution(games)}
        </div>
      </div>
    </div>

    <!-- 탭 2: 번호 채점기 & 직전 당첨 확인 -->
    <div class="tab-content ${currentTab === 'checker' ? 'active' : ''}" id="tab-checker">
      <div class="checker-card">
        <div class="section-heading" style="margin-bottom: 12px;">
          <span>직전 회차(제1247회) 공식 당첨 번호</span>
        </div>
        <div class="balls-row" style="margin-bottom: 24px;">
          ${RECENT_ROUNDS[0].numbers.map(n => renderBall(n)).join('')}
          <div style="font-size: 1.2rem; color: #64748b; font-weight: 800; padding: 0 4px;">+</div>
          ${renderBall(RECENT_ROUNDS[0].bonus, true)}
          <span style="font-size: 0.88rem; color: #94a3b8; margin-left: 8px;">(1등 8명 / 각 36.4억)</span>
        </div>

        <h5 style="margin-bottom: 8px; font-weight: 700;">내 번호 직접 입력 채점하기</h5>
        <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 14px;">
          원하시는 6개 번호를 입력하거나 아래 버튼을 누르면 직전 당첨 번호와 즉시 대조합니다.
        </p>

        <div class="checker-inputs">
          ${[0, 1, 2, 3, 4, 5].map(idx => `
            <input type="number" min="1" max="45" class="ball-input" data-idx="${idx}" value="${customInputs[idx]}" placeholder="${idx + 1}" />
          `).join('')}
          <button class="btn btn-primary" id="check-ticket-btn" style="height: 52px; padding: 0 24px;">
            당첨 확인
          </button>
        </div>

        <div id="checker-result-area"></div>
      </div>
    </div>

    <!-- 탭 3: 회차별 타임머신 -->
    <div class="tab-content ${currentTab === 'history' ? 'active' : ''}" id="tab-history">
      <div class="analysis-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h5 style="margin: 0;">과거 회차 추천 번호 검증</h5>
          <select id="round-select" style="background: #0f172a; color: #f59e0b; border: 1px solid #334155; padding: 6px 12px; border-radius: 8px; font-weight: 700;">
            ${[state.targetRound, 1247, 1246, 1245, 1244, 1243].map(r => `
              <option value="${r}" ${r === activeRound ? 'selected' : ''}>제 ${r} 회차</option>
            `).join('')}
          </select>
        </div>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.6;">
          LottoGolden은 회차별 고유 시드 기반으로 번호가 생성되므로, 이전 회차를 선택하셔도 당시 추천되었던 5게임이 100% 동일하게 복원됩니다. 언제든 투명하게 확인해보실 수 있습니다.
        </p>
      </div>

      <div class="history-list">
        <h5 style="margin-bottom: 12px; font-weight: 700;">최근 6개 회차 실제 당첨 번호 내역</h5>
        ${RECENT_ROUNDS.map(r => `
          <div class="history-item">
            <div class="history-round">제 ${r.round} 회 (${r.date})</div>
            <div class="balls-row">
              ${r.numbers.map(n => renderBall(n)).join('')}
              <div style="font-size: 1rem; color: #64748b; font-weight: 700;">+</div>
              ${renderBall(r.bonus, true)}
            </div>
            <div style="font-size: 0.88rem; color: #34d399; font-weight: 600;">
              1등 ${r.prize} (${r.winners}명)
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 실물 로또 영수증 슬립 모달 -->
    <div class="modal-overlay" id="slip-modal">
      <div class="modal-card">
        <button class="modal-close" id="close-slip-modal-btn">&times;</button>
        <div class="ticket-slip">
          <div class="ticket-header">
            <h3>동행복권 LOTTO 6/45</h3>
            <p style="font-size: 0.8rem; color: #64748b;">제 ${activeRound} 회차 (골든 추천 슬립)</p>
            <p style="font-size: 0.72rem; color: #94a3b8;">추첨일: 토요일 20:35 / 발행: LottoGolden</p>
          </div>
          <div class="slip-body">
            ${games.map(g => `
              <div class="slip-game-row">
                <span class="game-label">${g.id} 자 동</span>
                <span class="slip-game-numbers">${g.numbers.map(n => String(n).padStart(2, '0')).join('  ')}</span>
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
            <p style="font-size: 0.78rem; font-weight: 700; color: #475569;">금주의 행운을 진심으로 기원합니다!</p>
            <p style="font-size: 0.68rem; color: #94a3b8; margin-top: 4px;">복권은 소액으로 건전하게 즐기세요.</p>
          </div>
        </div>
        <div style="margin-top: 18px; display: flex; gap: 10px;">
          <button class="btn btn-primary" id="slip-copy-btn" style="flex: 1; justify-content: center;">
            텍스트 전체 복사
          </button>
          <button class="btn btn-secondary" onclick="window.print()" style="justify-content: center;">
            인쇄하기
          </button>
        </div>
      </div>
    </div>

    <!-- 고정 원칙 안내 모달 -->
    <div class="modal-overlay" id="rule-modal">
      <div class="modal-card">
        <button class="modal-close" id="close-rule-modal-btn">&times;</button>
        <h3 style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: var(--gold-primary); margin-bottom: 14px;">
          🔒 주간 고정 원칙 & 알고리즘 보증
        </h3>
        <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.7; display: flex; flex-direction: column; gap: 14px;">
          <p>
            <strong>1. 왜 클릭할 때마다 번호가 바뀌지 않나요?</strong><br/>
            일반적인 가짜 생성기처럼 새로고침이나 클릭 시마다 번호가 계속 바뀌면 어떤 번호를 신뢰하고 사야 할지 혼란스럽습니다. 본 서비스는 <strong>토요일 오후 9시부터 다음 주 토요일 오후 8시까지 1주일간 동일한 번호를 엄격히 유지</strong>합니다.
          </p>
          <p>
            <strong>2. 주간 주기 타임라인 (KST 기준)</strong><br/>
            • <strong>토요일 21:00:00:</strong> 차기 회차 5대 골든 번호 자동 공개 및 1주일 고정 시작<br/>
            • <strong>다음 주 토요일 20:00:00:</strong> 복권 판매 마감에 맞춰 번호 마감 및 추첨 카운트다운<br/>
            • <strong>토요일 20:00 ~ 21:00:</strong> 실제 추첨 방송 및 당첨자 집계 진행
          </p>
          <p>
            <strong>3. 결정론적 시드 PRNG 알고리즘</strong><br/>
            회차 번호를 고유 시드로 결합한 <code>Mulberry32</code> 암호화 수준의 의사 난수 엔진을 사용하여 브라우저 캐시나 기기 환경에 무관하게 항상 일관된 결과를 산출합니다.
          </p>
        </div>
      </div>
    </div>
  `;

  bindEvents(games, activeRound);
  updateCountdown();
}

// 대역별 분포 바 렌더링
function renderDecileBars(games) {
  const totals = { yellow: 0, blue: 0, red: 0, gray: 0, green: 0 };
  games.forEach(g => {
    Object.keys(totals).forEach(k => {
      totals[k] += g.stats.deciles[k];
    });
  });
  const grandTotal = 30; // 5 games * 6 balls

  const meta = [
    { key: 'yellow', label: '1~10번대 (노랑)', color: '#f59e0b' },
    { key: 'blue', label: '11~20번대 (파랑)', color: '#3b82f6' },
    { key: 'red', label: '21~30번대 (빨강)', color: '#ef4444' },
    { key: 'gray', label: '31~40번대 (회색)', color: '#64748b' },
    { key: 'green', label: '41~45번대 (초록)', color: '#10b981' }
  ];

  return meta.map(m => {
    const count = totals[m.key];
    const pct = Math.round((count / grandTotal) * 100);
    return `
      <div class="dist-item">
        <div class="dist-header">
          <span>${m.label}</span>
          <span style="font-weight: 700; color: ${m.color}">${count}개 (${pct}%)</span>
        </div>
        <div class="dist-track">
          <div class="dist-bar" style="width: ${pct}%; background: ${m.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// 홀짝 요약
function renderOddEvenSummary(games) {
  let odd = 0, even = 0;
  games.forEach(g => {
    odd += g.stats.oddCount;
    even += g.stats.evenCount;
  });
  return `
    <div style="display: flex; gap: 16px; align-items: center; justify-content: space-around; padding: 12px 0;">
      <div style="text-align: center;">
        <div style="font-size: 2rem; font-weight: 800; color: #38bdf8; font-family: var(--font-display);">${odd}</div>
        <div style="font-size: 0.85rem; color: #94a3b8;">홀수 (Odd)</div>
      </div>
      <div style="font-size: 1.5rem; color: #475569; font-weight: 700;">:</div>
      <div style="text-align: center;">
        <div style="font-size: 2rem; font-weight: 800; color: #fbbf24; font-family: var(--font-display);">${even}</div>
        <div style="font-size: 0.85rem; color: #94a3b8;">짝수 (Even)</div>
      </div>
    </div>
    <p style="font-size: 0.82rem; color: #94a3b8; text-align: center; margin-top: 8px;">
      역대 1등 당첨 통계에서 가장 빈출된 <strong>3:3 및 4:2 균형 분할 비율</strong> 준수
    </p>
  `;
}

// 총합 요약
function renderSumDistribution(games) {
  const sums = games.map(g => `${g.id}게임: ${g.stats.sum}`);
  return `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 6px 0;">
      ${games.map(g => `
        <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
          <span style="color: #cbd5e1; font-weight: 600;">${g.id}게임 (${g.title})</span>
          <span style="color: #fbbf24; font-weight: 700; font-family: var(--font-mono);">총합 ${g.stats.sum}</span>
        </div>
      `).join('')}
    </div>
    <div style="margin-top: 10px; padding: 8px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; font-size: 0.8rem; color: #34d399;">
      ✓ 모든 게임이 역대 1등 최다 배출 구간(총합 120~160)에 정밀 설계되었습니다.
    </div>
  `;
}

// 이벤트 바인딩
function bindEvents(games, activeRound) {
  // 개별 게임 번호 복사
  document.querySelectorAll('.copy-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gameId = btn.getAttribute('data-game');
      const numbers = btn.getAttribute('data-numbers');
      const text = `[LottoGolden 제${activeRound}회] ${gameId}게임: ${numbers}`;
      navigator.clipboard.writeText(text).then(() => {
        showToast(`${gameId}게임 번호가 복사되었습니다!`, '📋');
        confetti({ particleCount: 30, spread: 45, origin: { y: 0.8 } });
      });
    });
  });

  // 5게임 일괄 복사
  const copyAllBtn = document.getElementById('copy-all-btn');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      const lines = [
        `🎰 [LottoGolden 제 ${activeRound} 회차 골든 추천 번호]`,
        `유지 기간: 토요일 21:00 ~ 차주 토요일 20:00 (1주일 고정)`,
        `----------------------------------------`
      ];
      games.forEach(g => {
        lines.push(`${g.id}게임: ${g.numbers.map(n => String(n).padStart(2, '0')).join(', ')} (${g.title})`);
      });
      lines.push(`----------------------------------------`);
      lines.push(`행운을 빕니다! 🍀`);

      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        showToast('5게임 전체가 클립보드에 복사되었습니다!', '🎉');
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      });
    });
  }

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.getAttribute('data-tab');
      renderApp();
    });
  });

  // 회차 셀렉트
  const roundSelect = document.getElementById('round-select');
  if (roundSelect) {
    roundSelect.addEventListener('change', (e) => {
      selectedRound = parseInt(e.target.value, 10);
      renderApp();
    });
  }

  // 모달 제어
  const slipModal = document.getElementById('slip-modal');
  const openSlipBtn = document.getElementById('open-slip-modal-btn');
  const closeSlipBtn = document.getElementById('close-slip-modal-btn');

  if (openSlipBtn && slipModal) {
    openSlipBtn.addEventListener('click', () => slipModal.classList.add('open'));
  }
  if (closeSlipBtn && slipModal) {
    closeSlipBtn.addEventListener('click', () => slipModal.classList.remove('open'));
  }

  const ruleModal = document.getElementById('rule-modal');
  const openRuleBtn = document.getElementById('open-rule-modal-btn');
  const closeRuleBtn = document.getElementById('close-rule-modal-btn');

  if (openRuleBtn && ruleModal) {
    openRuleBtn.addEventListener('click', () => ruleModal.classList.add('open'));
  }
  if (closeRuleBtn && ruleModal) {
    closeRuleBtn.addEventListener('click', () => ruleModal.classList.remove('open'));
  }

  // 모달 바깥 클릭 시 닫기
  [slipModal, ruleModal].forEach(m => {
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    }
  });

  // 슬립 텍스트 복사
  const slipCopyBtn = document.getElementById('slip-copy-btn');
  if (slipCopyBtn) {
    slipCopyBtn.addEventListener('click', () => {
      const lines = games.map(g => `${g.id}: ${g.numbers.join(' ')}`).join('\n');
      navigator.clipboard.writeText(lines).then(() => {
        showToast('슬립 번호가 복사되었습니다!', '🧾');
      });
    });
  }

  // 번호 채점기 입력 이벤트
  const inputs = document.querySelectorAll('.ball-input');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      let val = parseInt(e.target.value, 10);
      if (val > 45) val = 45;
      if (val < 1 && e.target.value !== '') val = 1;
      customInputs[idx] = isNaN(val) ? '' : val;
      if (val && idx < 5) {
        const next = document.querySelector(`.ball-input[data-idx="${idx + 1}"]`);
        if (next) next.focus();
      }
    });
  });

  const checkBtn = document.getElementById('check-ticket-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const userNums = customInputs.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 45);
      const uniqueNums = Array.from(new Set(userNums)).sort((a, b) => a - b);
      const resultArea = document.getElementById('checker-result-area');

      if (uniqueNums.length < 6) {
        showToast('1부터 45 사이의 서로 다른 6개 번호를 모두 입력해주세요.', '⚠️');
        return;
      }

      const evalResult = evaluateTicket(uniqueNums, RECENT_ROUNDS[0].numbers, RECENT_ROUNDS[0].bonus);
      
      let badgeColor = '#64748b';
      if (evalResult.rank === 1) badgeColor = '#fbbf24';
      else if (evalResult.rank === 2) badgeColor = '#38bdf8';
      else if (evalResult.rank === 3) badgeColor = '#f43f5e';
      else if (evalResult.rank >= 4) badgeColor = '#10b981';

      if (evalResult.rank > 0 && evalResult.rank <= 3) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      }

      resultArea.innerHTML = `
        <div class="checker-result-box" style="border-left-color: ${badgeColor};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 style="font-size: 1.15rem; font-weight: 800; color: ${badgeColor};">${evalResult.label}</h4>
            <span style="font-size: 0.85rem; color: #94a3b8;">일치 번호: <strong>${evalResult.matchCount}개</strong> ${evalResult.hasBonus ? '(+ 보너스 일치)' : ''}</span>
          </div>
          <p style="font-size: 0.85rem; color: #cbd5e1;">
            입력 번호: [${uniqueNums.join(', ')}] | 일치 번호: [${evalResult.matchedNumbers.length > 0 ? evalResult.matchedNumbers.join(', ') : '없음'}]
          </p>
        </div>
      `;
      showToast(evalResult.label, '🎯');
    });
  }
}

// 카운트다운 타이머 갱신 (1초마다 자동 실행)
function updateCountdown() {
  const container = document.getElementById('countdown-units');
  if (!container) return;

  const state = getLottoState();
  const ms = state.status === 'DRAWING' ? state.timeUntilReleaseMs : state.timeRemainingMs;

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / (3600 * 24));
  const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n) => String(n).padStart(2, '0');

  container.innerHTML = `
    <div class="countdown-box">
      <span class="num">${pad(days)}</span>
      <span class="unit">일</span>
    </div>
    <span class="countdown-sep">:</span>
    <div class="countdown-box">
      <span class="num">${pad(hours)}</span>
      <span class="unit">시간</span>
    </div>
    <span class="countdown-sep">:</span>
    <div class="countdown-box">
      <span class="num">${pad(minutes)}</span>
      <span class="unit">분</span>
    </div>
    <span class="countdown-sep">:</span>
    <div class="countdown-box">
      <span class="num">${pad(seconds)}</span>
      <span class="unit">초</span>
    </div>
  `;
}

// 타이머 인터벌
setInterval(() => {
  updateCountdown();
  // 상태가 바뀔 시각이 되면 전체 다시 렌더링
  const state = getLottoState();
  if (state.timeRemainingMs === 0 || state.timeUntilReleaseMs === 0) {
    renderApp();
  }
}, 1000);

// 초기 실행
renderApp();
