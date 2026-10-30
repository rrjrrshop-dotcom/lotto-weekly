/**
 * storage.js
 * 
 * LottoGolden 6/45 티켓 보관함 DB CRUD 매니저
 * - 브라우저 영구 로컬 저장소(localStorage / IndexedDB 확장 가능) 기반
 * - 완벽한 CRUD (Create, Read, Update, Delete) 지원
 * - JSON 백업 내보내기 & 불러오기 지원 (PC <-> 모바일 데이터 이동 가능)
 */

const STORAGE_KEY = 'lotto_golden_tickets_v1';

/**
 * 티켓 모델 스키마:
 * {
 *   id: string,               // 고유 식별자 (UUID / timestamp 기반)
 *   round: number,            // 회차 (예: 1248)
 *   label: string,            // 게임명 (예: "A 게임 (다빈출 균형)", "수동 1")
 *   numbers: number[],        // 6개 정렬된 번호 [4, 12, 18, 27, 34, 43]
 *   memo: string,             // 사용자 메모 (예: "강남역 판매점에서 구매")
 *   isPurchased: boolean,     // 실제 구매 여부
 *   createdAt: string,        // ISO 날짜 문자열
 *   updatedAt: string         // ISO 날짜 문자열
 * }
 */

// 모든 티켓 목록 조회 (Read - All)
export function getTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to read tickets from storage:', err);
    return [];
  }
}

// 특정 티켓 단건 조회 (Read - One)
export function getTicketById(id) {
  const tickets = getTickets();
  return tickets.find(t => t.id === id) || null;
}

// 새 티켓 생성 및 저장 (Create)
export function createTicket({ round, numbers, label = '골든 추천 번호', memo = '', isPurchased = false }) {
  const tickets = getTickets();
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  
  const newTicket = {
    id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    round: Number(round),
    label: label.trim() || '추천 번호',
    numbers: sortedNumbers,
    memo: memo.trim(),
    isPurchased: Boolean(isPurchased),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tickets.unshift(newTicket); // 최신순 정렬
  saveTicketsToStorage(tickets);
  return newTicket;
}

// 5게임 일괄 생성 (Bulk Create)
export function createBulkTickets(games, round, memo = '금주 5게임 일괄 저장') {
  const tickets = getTickets();
  const now = new Date().toISOString();
  
  const createdList = games.map((game, idx) => ({
    id: `ticket_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
    round: Number(round),
    label: `${game.id}게임 (${game.title})`,
    numbers: [...game.numbers].sort((a, b) => a - b),
    memo: memo.trim(),
    isPurchased: false,
    createdAt: now,
    updatedAt: now
  }));

  const updatedTickets = [...createdList, ...tickets];
  saveTicketsToStorage(updatedTickets);
  return createdList;
}

// 티켓 정보 수정 (Update)
export function updateTicket(id, updates) {
  const tickets = getTickets();
  const index = tickets.findIndex(t => t.id === id);
  if (index === -1) return null;

  const current = tickets[index];
  const updatedTicket = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (updates.numbers) {
    updatedTicket.numbers = [...updates.numbers].sort((a, b) => a - b);
  }

  tickets[index] = updatedTicket;
  saveTicketsToStorage(tickets);
  return updatedTicket;
}

// 티켓 단건 삭제 (Delete)
export function deleteTicket(id) {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.id !== id);
  const isDeleted = filtered.length !== tickets.length;
  if (isDeleted) {
    saveTicketsToStorage(filtered);
  }
  return isDeleted;
}

// 특정 회차 티켓 전체 삭제
export function deleteTicketsByRound(round) {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.round !== Number(round));
  saveTicketsToStorage(filtered);
  return tickets.length - filtered.length;
}

// 전체 티켓 비우기 (Clear All)
export function clearAllTickets() {
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

// 데이터 내보내기 (Export JSON)
export function exportTicketsJSON() {
  const tickets = getTickets();
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    totalCount: tickets.length,
    tickets
  };
  return JSON.stringify(exportData, null, 2);
}

// 데이터 불러오기 (Import JSON)
export function importTicketsJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.tickets)) {
      throw new Error('유효한 로또 티켓 백업 데이터가 아닙니다.');
    }

    const currentTickets = getTickets();
    const existingIds = new Set(currentTickets.map(t => t.id));
    let importedCount = 0;

    data.tickets.forEach(ticket => {
      if (ticket.numbers && ticket.numbers.length === 6 && ticket.round) {
        if (!existingIds.has(ticket.id)) {
          currentTickets.push(ticket);
          existingIds.add(ticket.id);
          importedCount++;
        }
      }
    });

    currentTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    saveTicketsToStorage(currentTickets);
    return { success: true, count: importedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 내부 헬퍼: 스토리지 저장
function saveTicketsToStorage(tickets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.error('Failed to save tickets to storage:', err);
  }
}
