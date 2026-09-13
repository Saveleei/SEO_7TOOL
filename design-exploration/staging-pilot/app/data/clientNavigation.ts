type ClientRouter = {
  push: (href: string) => void;
  refresh: () => void;
};

function usesDocumentNavigation() {
  return document.documentElement.dataset.documentNavigation === "true";
}

export function navigateTo(router: Pick<ClientRouter, "push">, href: string) {
  if (usesDocumentNavigation()) window.location.assign(href);
  else router.push(href);
}

export function refreshRoute(router: Pick<ClientRouter, "refresh">) {
  if (usesDocumentNavigation()) window.location.reload();
  else router.refresh();
}
