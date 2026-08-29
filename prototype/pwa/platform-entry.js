(() => {
  const params = new URLSearchParams(window.location.search);
  const desktopViewport = window.matchMedia("(min-width: 900px)");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const forceMobile = params.get("mobile") === "1";

  if (standalone || forceMobile) return;

  function enterDesktopWorkspace() {
    const desktopUrl = new URL("/prototype/", window.location.origin);
    const screen = params.get("screen");

    if (screen === "journal") desktopUrl.searchParams.set("view", "journal");
    desktopUrl.searchParams.set("from", "mobile");
    window.location.replace(desktopUrl);
  }

  if (desktopViewport.matches) {
    enterDesktopWorkspace();
    return;
  }

  desktopViewport.addEventListener("change", (event) => {
    if (event.matches) enterDesktopWorkspace();
  });
})();
