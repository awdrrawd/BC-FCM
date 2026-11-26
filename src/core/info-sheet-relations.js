// BC 資訊頁（InformationSheet）的關係列：主人 (.information-sheet-owner)、戀人 (.information-sheet-lover)。
// 舊版 BC 的戀人列叫 .information-sheet-entry-title，一併保留相容。
// 注意：不能限定在 .information-sheet-relations-slot 底下 —— BC 只有在「非本人、非線上角色」時才會
// 包這層容器，本人／線上角色的關係區塊是直接放在頁面欄位裡，限定容器會讓戀人行永遠找不到。
export const INFO_RELATION_ROW_SELECTOR = '.information-sheet-owner, .information-sheet-lover, .information-sheet-entry-title';

/**
 * 為資訊頁每個帶會員編號的關係列掛上搜尋入口。
 * 優先掛在其後的「持續時間」行（.information-sheet-since）；沒有該行（無起算時間）時退回列尾按鈕。
 * 以 row.dataset.fcmSearch 防止重複掛載。
 * @param {ParentNode} sheet
 * @param {{ attachSince: (line: Element, member: number) => void, makeButton: (member: number) => Element }} hooks
 * @returns {number} 本次新掛上的列數
 */
export function decorateInfoSheetRelations(sheet, { attachSince, makeButton }) {
    let decorated = 0;
    for (const row of sheet.querySelectorAll(INFO_RELATION_ROW_SELECTOR)) {
        if (row.dataset.fcmSearch) continue;
        const fields = row.querySelectorAll('.information-sheet-copy');
        if (fields.length !== 2 || !/^\d+$/.test(fields[1].textContent)) continue;
        row.dataset.fcmSearch = '1';
        const member = Number(fields[1].textContent);
        const since = row.nextElementSibling;
        if (since && since.classList.contains('information-sheet-since')) attachSince(since, member);
        else row.append(makeButton(member));
        decorated++;
    }
    return decorated;
}
