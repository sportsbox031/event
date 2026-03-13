export function createAdminTableMessage(colspan, message) {
  return `<tr><td colspan="${colspan}" style="text-align:center;color:#999;padding:40px;">${message}</td></tr>`;
}
