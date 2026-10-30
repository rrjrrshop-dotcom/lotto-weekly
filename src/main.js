import './style.css';
import confetti from 'canvas-confetti';
import {
  getLottoState,
  generateWeeklyGames,
  getBallColorInfo,
  RECENT_ROUNDS,
  evaluateTicket
} from './lottoEngine.js';
import {
  getTickets,
  getTicketById,
  createTicket,
  createBulkTickets,
  updateTicket,
  deleteTicket,
  clearAllTickets,
  exportTicketsJSON,
  importTicketsJSON
} from './storage.js';

// 애플리케이션 상태
let currentTab = 'analysis'; // 'analysis' | 'storage' | 'checker' | 'history'
let storageFilter = 'all'; // 'all' | 'current' | 'purchased' | 'won'
let selectedRound = null;
let customInputs = ['', '', '', '', '', ''];
let editingTicketId = null; // null: 생성 모드, string: 수정 모드

// 토스트 메시지 헬퍼
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

// 메인 렌더 함수
function renderApp() {
  const app = document.getElementById('app');
  const state = getLottoState();
  const activeRound = selectedRound || state.targetRound;
  const isCurrentActiveRound = activeRound === state.targetRound;
  const games = generateWeeklyGames(activeRound);
  const allTickets = getTickets();

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
        매주 <strong>토요일 오후 9시</strong>부터 <strong>다음 주 토요일 오후 8시</strong>까지 1주일간 절대 변하지 않는 신뢰의 5대 골든 조합 & 나만의 번호 보관함
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
        <button class="btn btn-secondary" id="save-all-to-db-btn" title="금주 5게임을 내 보관함 DB에 한 번에 저장">
          <span>💾 5게임 일괄 저장</span>
        </button>
        <button class="btn" id="open-slip-modal-btn">
          <span>🧾 실물 슬립 보기</span>
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
            <div style="display: flex; gap: 6px;">
              <button class="btn-icon save-single-game-btn" data-game="${game.id}" data-numbers="${game.numbers.join(',')}" data-title="${game.id}게임 (${game.title})" title="내 보관함 DB에 저장">
                <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              </button>
              <button class="btn-icon copy-game-btn" data-game="${game.id}" data-numbers="${game.numbers.join(', ')}" title="이 번호 복사">
                <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </section>

    <!-- 탭 네비게이션 -->
    <nav class="tabs-nav">
      <button class="tab-btn ${currentTab === 'storage' ? 'active' : ''}" data-tab="storage">
        💾 나의 번호 보관함 (${allTickets.length})
      </button>
      <button class="tab-btn ${currentTab === 'analysis' ? 'active' : ''}" data-tab="analysis">
        📊 심층 통계 분석
      </button>
      <button class="tab-btn ${currentTab === 'checker' ? 'active' : ''}" data-tab="checker">
        🎯 번호 채점기 & 당첨 확인
      </button>
      <button class="tab-btn ${currentTab === 'history' ? 'active' : ''}" data-tab="history">
        📜 회차별 타임머신
      </button>
    </nav>

    <!-- 탭 1: DB 번호 보관함 (CRUD 전용 화면) -->
    <div class="tab-content ${currentTab === 'storage' ? 'active' : ''}" id="tab-storage">
      ${renderStorageSection(allTickets, state.targetRound)}
    </div>

    <!-- 탭 2: 심층 통계 분석 -->
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

    <!-- 탭 3: 번호 채점기 & 직전 당첨 확인 -->
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
          원하시는 6개 번호를 입력하거나 보관함 번호와 즉시 대조해보세요.
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

    <!-- 탭 4: 회차별 타임머신 -->
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
          LottoGolden은 회차별 고유 시드 기반으로 번호가 산출되므로, 이전 회차를 선택하셔도 당시 추천 번호 5게임이 100% 동일하게 복원됩니다.
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
            회차 번호를 고유 시드로 결합한 <code>Mulberry32</code> 의사 난수 엔진을 사용하여 브라우저 캐시나 기기 환경에 무관하게 항상 일관된 결과를 산출합니다.
          </p>
        </div>
      </div>
    </div>

    <!-- 티켓 추가/수정 모달 (CRUD Modal) -->
    <div class="modal-overlay" id="ticket-form-modal">
      <div class="modal-card">
        <button class="modal-close" id="close-ticket-form-modal-btn">&times;</button>
        <h3 style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: var(--gold-primary); margin-bottom: 16px;" id="ticket-modal-title">
          💾 티켓 저장 / 수정
        </h3>
        
        <form id="ticket-crud-form">
          <div class="form-group">
            <label>회차 (Round)</label>
            <input type="number" id="form-ticket-round" class="form-input" min="1" max="9999" required />
          </div>

          <div class="form-group">
            <label>티켓 레이블 (이름)</label>
            <input type="text" id="form-ticket-label" class="form-input" placeholder="예: A게임 (다빈출 추천), 자동 구매 등" required />
          </div>

          <div class="form-group">
            <label>로또 6개 번호 (1 ~ 45)</label>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;">
              ${[0, 1, 2, 3, 4, 5].map(i => `
                <input type="number" min="1" max="45" class="form-input form-num-input" data-idx="${i}" placeholder="번호" required style="text-align: center; font-weight: 700; font-family: var(--font-mono); padding: 8px 4px;" />
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>메모 (구매 장소, 메모 등)</label>
            <input type="text" id="form-ticket-memo" class="form-input" placeholder="예: 판교역 로또명당 구매, 꿈에서 본 번호" />
          </div>

          <label class="form-checkbox-row">
            <input type="checkbox" id="form-ticket-purchased" />
            <span style="font-size: 0.9rem; color: #cbd5e1; font-weight: 600;">실제 복권 구매 완료 (체크 시 구매 목록으로 분류)</span>
          </label>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="submit" class="btn btn-primary" style="flex: 1; justify-content: center;">
              저장 완료
            </button>
            <button type="button" class="btn" id="cancel-ticket-form-btn">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 숨김 파일 입력기 (JSON 백업 복원용) -->
    <input type="file" id="import-json-file-input" accept=".json" style="display: none;" />
  `;

  bindEvents(games, activeRound);
  updateCountdown();
}

// ========================================================
// DB 보관함 섹션 렌더링 (Read / Filter / Stats)
// ========================================================
function renderStorageSection(allTickets, targetRound) {
  // 필터링 적용
  let filtered = [...allTickets];
  if (storageFilter === 'current') {
    filtered = filtered.filter(t => t.round === targetRound);
  } else if (storageFilter === 'purchased') {
    filtered = filtered.filter(t => t.isPurchased);
  } else if (storageFilter === 'won') {
    filtered = filtered.filter(t => {
      const match = getTicketWinStatus(t);
      return match && match.rank > 0 && match.rank <= 5;
    });
  }

  // 통계 계산
  const totalCount = allTickets.length;
  const purchasedCount = allTickets.filter(t => t.isPurchased).length;
  const totalSpent = (purchasedCount * 1000).toLocaleString(); // 1게임 1000원
  let wonCount = 0;
  allTickets.forEach(t => {
    const match = getTicketWinStatus(t);
    if (match && match.rank > 0 && match.rank <= 5) wonCount++;
  });

  return `
    <div class="storage-hero">
      <div class="storage-stats-row">
        <div class="storage-stat-item">
          <span class="val">${totalCount}개</span>
          <span class="lbl">총 보관 티켓</span>
        </div>
        <div class="storage-stat-item">
          <span class="val" style="color: #34d399;">${purchasedCount}장</span>
          <span class="lbl">실제 구매 티켓</span>
        </div>
        <div class="storage-stat-item">
          <span class="val" style="color: #38bdf8;">${totalSpent}원</span>
          <span class="lbl">총 구매 지출액</span>
        </div>
        <div class="storage-stat-item">
          <span class="val" style="color: #fbbf24;">${wonCount}회</span>
          <span class="lbl">당첨 기록</span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary" id="open-add-ticket-modal-btn">
          <span>➕ 새 번호 직접 등록</span>
        </button>
        <button class="btn" id="export-backup-btn" title="보관함 전체 JSON 파일로 백업">
          <span>📥 백업</span>
        </button>
        <button class="btn" id="trigger-import-btn" title="JSON 백업 파일 복원">
          <span>📤 복원</span>
        </button>
      </div>
    </div>

    <!-- 필터 바 -->
    <div class="storage-controls-bar">
      <div class="filter-pills">
        <button class="filter-pill ${storageFilter === 'all' ? 'active' : ''}" data-filter="all">
          전체 보기 (${totalCount})
        </button>
        <button class="filter-pill ${storageFilter === 'current' ? 'active' : ''}" data-filter="current">
          이번 제${targetRound}회 (${allTickets.filter(t => t.round === targetRound).length})
        </button>
        <button class="filter-pill ${storageFilter === 'purchased' ? 'active' : ''}" data-filter="purchased">
          구매 완료 (${purchasedCount})
        </button>
        <button class="filter-pill ${storageFilter === 'won' ? 'active' : ''}" data-filter="won">
          당첨 티켓 (${wonCount})
        </button>
      </div>

      ${allTickets.length > 0 ? `
        <button class="btn" id="clear-all-tickets-btn" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); font-size: 0.8rem; padding: 6px 12px;">
          <span>🧹 전체 비우기</span>
        </button>
      ` : ''}
    </div>

    <!-- 티켓 목록 (Read List) -->
    <div class="ticket-list">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <span class="icon">🏷️</span>
          <h4 style="color: #cbd5e1; font-weight: 700; margin-bottom: 6px;">보관된 번호가 없습니다</h4>
          <p style="font-size: 0.85rem;">
            상단의 <strong>[5게임 일괄 저장]</strong>이나 게임별 <strong>[💾 저장]</strong> 버튼을 누르면 이 보관함에 영구 보관됩니다.
          </p>
        </div>
      ` : filtered.map(t => {
        const winStatus = getTicketWinStatus(t);
        return `
          <div class="ticket-item-card" data-ticket-id="${t.id}">
            <div class="ticket-item-header">
              <span class="ticket-round-badge">제 ${t.round}회</span>
              <div class="ticket-title-area">
                <h5>
                  <span>${t.label}</span>
                  ${renderWinBadge(winStatus)}
                </h5>
                <div class="date-memo">
                  ${t.memo ? `<span>💬 ${t.memo} · </span>` : ''}
                  <span>등록: ${new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div class="balls-row">
              ${t.numbers.map(n => renderBall(n)).join('')}
            </div>

            <div class="ticket-action-btns">
              <!-- 구매 상태 토글 (Update) -->
              <div class="purchase-toggle ${t.isPurchased ? 'purchased' : 'not-purchased'}" data-toggle-purchase="${t.id}" title="클릭하여 구매 완료/미구매 전환">
                <span>${t.isPurchased ? '✓ 구매완료' : '○ 미구매'}</span>
              </div>

              <!-- 수정 버튼 (Update) -->
              <button class="btn-icon edit-ticket-btn" data-edit-id="${t.id}" title="티켓 수정">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>

              <!-- 삭제 버튼 (Delete) -->
              <button class="btn-icon delete-ticket-btn" data-delete-id="${t.id}" title="티켓 삭제" style="color: #f43f5e;">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 티켓 당첨 여부 판별
function getTicketWinStatus(ticket) {
  const roundData = RECENT_ROUNDS.find(r => r.round === ticket.round);
  if (!roundData) {
    return { status: 'PENDING', label: '추첨 대기' };
  }
  const evalResult = evaluateTicket(ticket.numbers, roundData.numbers, roundData.bonus);
  return evalResult;
}

// 당첨 배지 HTML
function renderWinBadge(winStatus) {
  if (!winStatus || winStatus.status === 'PENDING') {
    return `<span class="win-badge wait">⏳ 대기중</span>`;
  }
  if (winStatus.rank > 0 && winStatus.rank <= 5) {
    return `<span class="win-badge won">🎉 ${winStatus.label}</span>`;
  }
  return `<span class="win-badge lose">낙첨</span>`;
}

// 대역별 분포 바 렌더링
function renderDecileBars(games) {
  const totals = { yellow: 0, blue: 0, red: 0, gray: 0, green: 0 };
  games.forEach(g => {
    Object.keys(totals).forEach(k => {
      totals[k] += g.stats.deciles[k];
    });
  });
  const grandTotal = 30;

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

// ========================================================
// 이벤트 바인딩 (CRUD Event Listeners)
// ========================================================
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

  // 5게임 보관함 DB 일괄 저장 (Bulk Create)
  const saveAllBtn = document.getElementById('save-all-to-db-btn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', () => {
      createBulkTickets(games, activeRound, `제${activeRound}회차 골든 5게임`);
      showToast(`제${activeRound}회 5게임이 내 보관함에 저장되었습니다!`, '💾');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      renderApp();
    });
  }

  // 단일 게임 보관함 DB 저장 (Single Create)
  document.querySelectorAll('.save-single-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const title = btn.getAttribute('data-title');
      const numsStr = btn.getAttribute('data-numbers');
      const numbers = numsStr.split(',').map(n => parseInt(n.trim(), 10));

      createTicket({
        round: activeRound,
        label: title,
        numbers,
        memo: `제${activeRound}회차 추천 조합`
      });

      showToast(`'${title}'이(가) 내 보관함에 저장되었습니다!`, '💾');
      renderApp();
    });
  });

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.getAttribute('data-tab');
      renderApp();
    });
  });

  // 보관함 필터 전환
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      storageFilter = btn.getAttribute('data-filter');
      renderApp();
    });
  });

  // 구매 상태 토글 (Update isPurchased)
  document.querySelectorAll('.purchase-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = btn.getAttribute('data-toggle-purchase');
      const ticket = getTicketById(ticketId);
      if (ticket) {
        updateTicket(ticketId, { isPurchased: !ticket.isPurchased });
        showToast(!ticket.isPurchased ? '구매 완료로 표시되었습니다.' : '미구매 상태로 변경되었습니다.', '🏷️');
        renderApp();
      }
    });
  });

  // 티켓 삭제 (Delete)
  document.querySelectorAll('.delete-ticket-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = btn.getAttribute('data-delete-id');
      if (confirm('이 티켓을 보관함에서 삭제하시겠습니까?')) {
        deleteTicket(ticketId);
        showToast('티켓이 삭제되었습니다.', '🗑️');
        renderApp();
      }
    });
  });

  // 보관함 전체 비우기 (Clear All)
  const clearAllBtn = document.getElementById('clear-all-tickets-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('보관함의 모든 티켓을 영구 삭제하시겠습니까? (삭제 전 백업을 권장합니다)')) {
        clearAllTickets();
        showToast('보관함이 초기화되었습니다.', '🧹');
        renderApp();
      }
    });
  }

  // JSON 백업 다운로드 (Export)
  const exportBtn = document.getElementById('export-backup-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const json = exportTicketsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lotto-tickets-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('백업 파일이 다운로드되었습니다!', '📥');
    });
  }

  // JSON 백업 복원 트리거 (Import)
  const triggerImportBtn = document.getElementById('trigger-import-btn');
  const importFileInput = document.getElementById('import-json-file-input');
  if (triggerImportBtn && importFileInput) {
    triggerImportBtn.addEventListener('click', () => {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = importTicketsJSON(event.target.result);
        if (result.success) {
          showToast(`${result.count}개의 티켓이 성공적으로 복원되었습니다!`, '📤');
          renderApp();
        } else {
          alert('복원 실패: ' + result.error);
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });
  }

  // 새 티켓 등록 모달 열기 (Create Modal Open)
  const openAddModalBtn = document.getElementById('open-add-ticket-modal-btn');
  const ticketFormModal = document.getElementById('ticket-form-modal');
  const closeTicketFormBtn = document.getElementById('close-ticket-form-modal-btn');
  const cancelTicketFormBtn = document.getElementById('cancel-ticket-form-btn');

  if (openAddModalBtn && ticketFormModal) {
    openAddModalBtn.addEventListener('click', () => {
      editingTicketId = null;
      document.getElementById('ticket-modal-title').textContent = '➕ 새 티켓 등록';
      document.getElementById('form-ticket-round').value = activeRound;
      document.getElementById('form-ticket-label').value = '';
      document.getElementById('form-ticket-memo').value = '';
      document.getElementById('form-ticket-purchased').checked = false;
      document.querySelectorAll('.form-num-input').forEach(input => input.value = '');
      ticketFormModal.classList.add('open');
    });
  }

  // 티켓 수정 모달 열기 (Edit Modal Open - Update)
  document.querySelectorAll('.edit-ticket-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = btn.getAttribute('data-edit-id');
      const ticket = getTicketById(ticketId);
      if (!ticket) return;

      editingTicketId = ticketId;
      document.getElementById('ticket-modal-title').textContent = '✏️ 티켓 정보 수정';
      document.getElementById('form-ticket-round').value = ticket.round;
      document.getElementById('form-ticket-label').value = ticket.label;
      document.getElementById('form-ticket-memo').value = ticket.memo || '';
      document.getElementById('form-ticket-purchased').checked = ticket.isPurchased;
      
      const numInputs = document.querySelectorAll('.form-num-input');
      ticket.numbers.forEach((num, idx) => {
        if (numInputs[idx]) numInputs[idx].value = num;
      });

      ticketFormModal.classList.add('open');
    });
  });

  const closeFormModal = () => {
    if (ticketFormModal) ticketFormModal.classList.remove('open');
  };
  if (closeTicketFormBtn) closeTicketFormBtn.addEventListener('click', closeFormModal);
  if (cancelTicketFormBtn) cancelTicketFormBtn.addEventListener('click', closeFormModal);

  // 티켓 폼 제출 (Create / Update Submit)
  const ticketForm = document.getElementById('ticket-crud-form');
  if (ticketForm) {
    ticketForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const round = parseInt(document.getElementById('form-ticket-round').value, 10);
      const label = document.getElementById('form-ticket-label').value;
      const memo = document.getElementById('form-ticket-memo').value;
      const isPurchased = document.getElementById('form-ticket-purchased').checked;

      const numInputs = Array.from(document.querySelectorAll('.form-num-input'));
      const numbers = numInputs.map(input => parseInt(input.value, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 45);
      const uniqueNumbers = Array.from(new Set(numbers));

      if (uniqueNumbers.length !== 6) {
        alert('1부터 45 사이의 서로 다른 6개의 번호를 모두 입력해주세요.');
        return;
      }

      if (editingTicketId) {
        // Update
        updateTicket(editingTicketId, {
          round,
          label,
          numbers: uniqueNumbers,
          memo,
          isPurchased
        });
        showToast('티켓 정보가 수정되었습니다!', '✏️');
      } else {
        // Create
        createTicket({
          round,
          label,
          numbers: uniqueNumbers,
          memo,
          isPurchased
        });
        showToast('새 티켓이 보관함에 저장되었습니다!', '💾');
      }

      closeFormModal();
      renderApp();
    });
  }

  // 폼 입력 시 다음 번호 인풋으로 자동 포커스
  document.querySelectorAll('.form-num-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      let val = parseInt(e.target.value, 10);
      if (val > 45) e.target.value = 45;
      if (val < 1 && e.target.value !== '') e.target.value = 1;
      if (e.target.value && idx < 5) {
        const next = document.querySelector(`.form-num-input[data-idx="${idx + 1}"]`);
        if (next) next.focus();
      }
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

  [slipModal, ruleModal, ticketFormModal].forEach(m => {
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
  const state = getLottoState();
  if (state.timeRemainingMs === 0 || state.timeUntilReleaseMs === 0) {
    renderApp();
  }
}, 1000);

// 초기 실행
renderApp();
