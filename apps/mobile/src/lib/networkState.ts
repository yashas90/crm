let online = true;

export function setNetworkOnline(value: boolean) {
  online = value;
}

export function isNetworkOnline() {
  return online;
}
