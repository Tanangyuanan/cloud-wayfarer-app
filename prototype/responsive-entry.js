(() => {
  const mobileViewport = window.matchMedia("(max-width: 899px)");
  const sourceUrl = new URL(window.location.href);

  if (sourceUrl.searchParams.get("desktop") === "1") return;

  function enterMobileApp() {
    const mobileUrl = new URL("/app/", window.location.origin);
    const requestedView = sourceUrl.searchParams.get("view");
    let hasSeenIntro = false;

    try {
      hasSeenIntro = window.localStorage.getItem("cloud_wayfarer-pwa-recognized-v1") === "true";
    } catch {
      // 无持久化权限时，优先保留首次邀请。
    }

    if (hasSeenIntro && sourceUrl.searchParams.get("intro") !== "1") {
      mobileUrl.searchParams.set("screen", requestedView === "journal" ? "journal" : "now");
    }
    mobileUrl.searchParams.set("from", "workspace");

    if (sourceUrl.searchParams.get("intro") === "1") mobileUrl.searchParams.set("intro", "1");
    window.location.replace(mobileUrl);
  }

  if (mobileViewport.matches) {
    enterMobileApp();
    return;
  }

  mobileViewport.addEventListener("change", (event) => {
    if (event.matches) enterMobileApp();
  });
})();
