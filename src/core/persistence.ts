// localStorage는 막혀 있을 수 있다(사생활 보호 창 등). 실패해도 수업은 계속된다.
export let storageError = false;

export function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageError = true;
    return null;
  }
}
export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    storageError = false;
    return true;
  } catch {
    storageError = true;
    return false;
  }
}
export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    storageError = true;
    return false;
  }
}
