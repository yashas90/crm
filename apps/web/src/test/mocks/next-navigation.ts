export function useRouter() {
  return { push: () => {}, replace: () => {}, back: () => {} };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
