/* ==================================================
   NAGI CUSTOM
   MAIN JAVASCRIPT
================================================== */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

  // ================================================
  // LOADING SCREEN
  // ================================================

  const loader = document.getElementById("loader");

  function hideLoader() {
    if (!loader) return;

    loader.classList.add("loaded");

    // アニメーション終了後に画面から除去
    window.setTimeout(() => {
      loader.style.display = "none";
    }, 700);
  }

  // 通常時は最大約1.5秒でローディングを終了
  window.setTimeout(hideLoader, 1500);

  // ================================================
  // HEADER SCROLL EFFECT
  // ================================================

  const header = document.getElementById("header");

  function updateHeader() {
    if (!header) return;

    header.classList.toggle(
      "scrolled",
      window.scrollY > 40
    );
  }

  window.addEventListener("scroll", updateHeader, {
    passive: true
  });

  updateHeader();

  // ================================================
  // MOBILE MENU
  // ================================================

  const menuToggle = document.getElementById("menuToggle");
  const navigation = document.getElementById("navigation");
  const navLinks = document.querySelectorAll(".nav-link, .nav-cta");

  function closeMenu() {
    if (!menuToggle || !navigation) return;

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "メニューを開く");

    navigation.classList.remove("open");
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    if (!menuToggle || !navigation) return;

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "メニューを閉じる");

    navigation.classList.add("open");
    document.body.classList.add("menu-open");
  }

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const isOpen =
        menuToggle.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navLinks.forEach(link => {
      link.addEventListener("click", closeMenu);
    });

    // メニューの外側をクリックしたとき
    document.addEventListener("click", event => {
      if (
        navigation.classList.contains("open") &&
        !navigation.contains(event.target) &&
        !menuToggle.contains(event.target)
      ) {
        closeMenu();
      }
    });

    // Escキーでメニューを閉じる
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });

    // PC表示に切り替わったらメニューをリセット
    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) {
        closeMenu();
      }
    });
  }

  // ================================================
  // SCROLL REVEAL
  // ================================================

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
      }
    );

    revealElements.forEach(element => {
      revealObserver.observe(element);
    });

  } else {

    // 古いブラウザ向けのフォールバック
    revealElements.forEach(element => {
      element.classList.add("visible");
    });

  }

  // ================================================
  // NAVIGATION ACTIVE STATE
  // ================================================

  const sections = document.querySelectorAll(
    "main section[id]"
  );

  const mainNavLinks = document.querySelectorAll(
    ".nav-link"
  );

  if ("IntersectionObserver" in window) {

    const sectionObserver = new IntersectionObserver(
      entries => {

        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const currentId = entry.target.id;

          mainNavLinks.forEach(link => {
            const targetId = link
              .getAttribute("href")
              .replace("#", "");

            link.classList.toggle(
              "active",
              targetId === currentId
            );
          });
        });

      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: 0
      }
    );

    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  }

  // ================================================
  // CURRENT YEAR
  // ================================================

  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  // ================================================
  // SMOOTH SCROLL
  // ================================================

  document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", event => {

      const href = link.getAttribute("href");

      if (!href || href === "#") return;

      const target = document.querySelector(href);

      if (!target) return;

      event.preventDefault();

      const headerHeight = header
        ? header.offsetHeight
        : 0;

      const targetPosition =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches ? "auto" : "smooth"
      });

      // URLのハッシュを更新
      if (history.replaceState) {
        history.replaceState(null, "", href);
      }

    });

  });

  // ================================================
  // INITIALIZE
  // ================================================

  // ブラウザの復元スクロール位置でも表示を整える
  window.addEventListener("pageshow", () => {
    updateHeader();
  });

  console.log(
    "%c NAGI CUSTOM ",
    "background:#ff6a00;color:#080808;font-weight:bold;padding:8px 12px;"
  );

  console.log(
    "Official event website initialized."
  );

});
