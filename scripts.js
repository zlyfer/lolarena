// API base URL is now loaded from config.js
let currentUser = null;
let champList = [];

// DOM elements
$(document).ready(function () {
  const $loginForm = $("#login-form");
  const $loginError = $("#login-error");
  const $championGridContainer = $("#champion-grid-container");
  const $searchFilter = $(".search-filter");
  const $usernameDisplay = $("#username-display");
  const $countInfo = $("#count-info");
  const $mainGrid = $("#main-grid");
  const $logoutBtn = $("#logout-btn");
  const $searchBar = $(".search-bar");
  const $clearSearchBtn = $(".clear-search-btn");
  const $filterButtons = $(".filter-button");
  const $themeToggleBtn = $("#theme-toggle");
  const $publicToggleBtn = $("#public-toggle-btn");
  const $publicProfileBtn = $("#public-profile-btn");

  // Theme variables
  const THEMES = ["auto", "light", "dark"];
  let currentThemeIndex = 0;
  let currentFilter = "all";

  // Scroll detection for top bar shadow
  $(window).on("scroll", function() {
    if ($(window).scrollTop() > 1) {
      $searchFilter.addClass("scrolled");
    } else {
      $searchFilter.removeClass("scrolled");
    }
  });

  // Init - check if user is logged in from localStorage
  initializeApp();

  function initializeApp() {
    // Hide public profile button by default
    $publicProfileBtn.hide();

    // Load user from localStorage if available
    const savedUser = localStorage.getItem("lolArenaUser");
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        fetchChampions();
        // Initialize public toggle button
        updatePublicToggleButton();
      } catch (e) {
        console.error("Error parsing saved user", e);
        showLoginForm();
      }
    } else {
      showLoginForm();
    }

    // Initialize theme
    initTheme();
  }

  // Login with click event
  $("#login-button").on("click", handleLogin);

  // Add keyboard event listeners for Enter key on login inputs
  $("#username").on("keyup", function (event) {
    if (event.key === "Enter") handleLogin();
  });

  $("#password").on("keyup", function (event) {
    if (event.key === "Enter") handleLogin();
  });

  // Handle login process
  async function handleLogin() {
    const username = $("#username").val();
    let password = $("#password").val();

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

    // Validate inputs
    if (!username || !hashHex) {
      $loginError.text("Please enter both username and password").show();
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/login`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ username, password: hashHex }),
      success: function (data) {
        if (data.success) {
          currentUser = data.user;
          localStorage.setItem("lolArenaUser", JSON.stringify(currentUser));
          fetchChampions();
          // Initialize public toggle button
          updatePublicToggleButton();
        } else {
          $loginError.text(data.message || "Login failed").show();
        }
      },
      error: function (xhr, status, error) {
        console.error("Error:", error);
        $loginError.text("An error occurred. Please try again.").show();
      }
    });
  }

  // Logout button
  $logoutBtn.on("click", function () {
    localStorage.removeItem("lolArenaUser");
    currentUser = null;
    showLoginForm();
  });

  // Fetch champions list
  function fetchChampions() {
    $.ajax({
      url: `${API_BASE_URL}/champions`,
      method: "GET",
      success: function (data) {
        if (data.success) {
          champList = data.champions;
          renderChampionGrid();
          showChampionGrid();
        } else {
          console.error("Error fetching champions:", data.message);
          $loginError.text("Error loading champions. Please try again.").show();
        }
      },
      error: function (xhr, status, error) {
        console.error("Error:", error);
        $loginError.text("An error occurred. Please try again.").show();
      }
    });
  }

  // Render champion grid
  function renderChampionGrid() {
    $mainGrid.empty();

    champList.forEach((champ) => {
      const isOwned = currentUser.champs.includes(champ);

      // Process champion name for URL
      let bgChampName = processChampionName(champ);

      const $card = $("<div>")
        .addClass(`champ-card ${isOwned ? "owned" : ""}`)
        .attr("data-champ", champ)
        .css("backgroundImage", `url('https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${bgChampName}_0.jpg')`);

      $card.html(`
        <div class="overlay"></div>
        <div class="checkmark">✓</div>
        <div class="loading-spinner"></div>
        <div class="champ-name">${champ}</div>
      `);

      $card.on("click", function () {
        toggleChampion($card, champ);
      });

      $mainGrid.append($card);
    });

    // Update user display
    $usernameDisplay.text(currentUser.username);
    $countInfo.text(`${currentUser.champs.length}/${champList.length}`);

    // Apply initial filters
    applyFilters();
  }

  // Process champion name for URL
  function processChampionName(champ) {
    // Special case handling for specific champions
    let bgChampName = champ;
    if (champ === "Wukong") bgChampName = "MonkeyKing";
    else if (champ === "Renata Glasc") bgChampName = "Renata";
    else if (champ === "K'Sante") bgChampName = "KSante";
    else if (champ === "Kog'Maw") bgChampName = "KogMaw";
    else if (champ === "Rek'Sai") bgChampName = "RekSai";
    else if (champ === "LeBlanc") bgChampName = "Leblanc";

    // 1. Replace apostrophes and make the next letter lowercase
    bgChampName = bgChampName.replace(/\'([A-Z])/g, (match, p1) => p1.toLowerCase());

    // 2. Remove any remaining spaces and periods
    return bgChampName.replace(/[ .]/g, "");
  }

  // Toggle champion ownership
  function toggleChampion($card, champName) {
    // Don't allow clicking if already in loading state
    if ($card.hasClass("loading")) {
      return;
    }

    // Set loading state
    const wasOwned = $card.hasClass("owned");
    $card.removeClass("owned").addClass("loading");

    $.ajax({
      url: `${API_BASE_URL}/toggle-champion`,
      method: "POST",
      contentType: "application/x-www-form-urlencoded",
      data: `userId=${currentUser.id}&championName=${encodeURIComponent(champName)}`,
      success: function (data) {
        // Remove loading state
        $card.removeClass("loading");

        if (data.success) {
          // Update currentUser.champs with the new list
          currentUser.champs = data.champions;
          localStorage.setItem("lolArenaUser", JSON.stringify(currentUser));

          // Toggle the owned class based on the new state
          if (wasOwned) {
            $card.removeClass("owned");
          } else {
            $card.addClass("owned");
          }

          // Update counter
          $countInfo.text(`${currentUser.champs.length}/${champList.length}`);

          // Re-apply current filter after state change
          applyFilters();
        } else {
          console.error("Error toggling champion:", data.message);
          // Restore previous state
          if (wasOwned) {
            $card.addClass("owned");
          }
          alert("Error: " + (data.message || "Failed to update champion"));
        }
      },
      error: function (xhr, status, error) {
        console.error("Error:", error);
        // Remove loading state and restore previous state
        $card.removeClass("loading");
        if (wasOwned) {
          $card.addClass("owned");
        }
        alert("Request failed. Please check your connection.");
      }
    });
  }

  /* ----- UI Functions ----- */

  function showLoginForm() {
    $loginForm.show();
    $championGridContainer.hide();
    $searchFilter.hide();
    $loginError.hide();
    $("#username").val("");
    $("#password").val("");
  }

  function showChampionGrid() {
    $loginForm.hide();
    $championGridContainer.show();
    $searchFilter.show();
  }

  // Filter buttons click handler
  $filterButtons.on("click", function () {
    // Update active button
    $filterButtons.removeClass("active");
    $(this).addClass("active");

    // Set current filter
    currentFilter = $(this).data("filter");

    // Apply filters
    applyFilters();
  });

  // Search input handler
  $searchBar.on("input", applyFilters);

  // Clear search button handler
  $clearSearchBtn.on("click", function () {
    $searchBar.val("").focus();
    applyFilters();
  });

  // Apply both search and ownership filters
  function applyFilters() {
    const searchTerm = $searchBar.val().toLowerCase();

    $(".champ-card").each(function () {
      const $card = $(this);
      const champName = $card.data("champ").toLowerCase();
      const isOwned = $card.hasClass("owned");

      // Determine visibility based on filter and search
      const showBasedOnFilter =
        currentFilter === "all" ||
        (currentFilter === "owned" && isOwned) ||
        (currentFilter === "unowned" && !isOwned);

      const matchesSearch = champName.includes(searchTerm);

      // Apply combined filter
      $card.toggleClass("filtered", !(showBasedOnFilter && matchesSearch));
    });
  }

  // Theme toggle functionality
  $themeToggleBtn.on("click", function () {
    currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
    const newTheme = THEMES[currentThemeIndex];
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
    updateThemeButtonText();
  });

  // Public/Private toggle functionality
  $publicToggleBtn.on("click", function () {
    const isCurrentlyPublic = currentUser.public;
    const newPublicState = !isCurrentlyPublic;

    // Show loading state
    $publicToggleBtn.prop("disabled", true);
    const originalText = $publicToggleBtn.find(".toggle-text").text();
    $publicToggleBtn.find(".toggle-text").text("...");

    $.ajax({
      url: `${API_BASE_URL}/set-public-state`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        userId: currentUser.id,
        public: newPublicState
      }),
      success: function (data) {
        if (data.success) {
          // Update currentUser with new public state
          currentUser.public = data.public;
          localStorage.setItem("lolArenaUser", JSON.stringify(currentUser));

          // Update button appearance
          updatePublicToggleButton();
        } else {
          console.error("Error setting public state:", data.message);
          alert("Error: " + (data.message || "Failed to update public state"));
        }
      },
      error: function (xhr, status, error) {
        console.error("Error:", error);
        alert("Request failed. Please check your connection.");
      },
      complete: function () {
        // Restore button state
        $publicToggleBtn.prop("disabled", false);
        $publicToggleBtn.find(".toggle-text").text(originalText);
      }
    });
  });

  // Public profile button functionality
  $publicProfileBtn.on("click", function () {
    if (currentUser && currentUser.username) {
      const publicProfileUrl = `${window.location.origin}/public.html?username=${encodeURIComponent(currentUser.username)}`;
      window.open(publicProfileUrl, '_blank');
    }
  });

  // Update public toggle button appearance
  async function updatePublicToggleButton() {
    const isPublic = currentUser.public;
    const $toggleText = await $publicToggleBtn.find(".toggle-text");

    if (isPublic) {
      $publicToggleBtn.removeClass("private");
      $toggleText.text("Public");
      $publicProfileBtn.show();
    } else {
      $publicToggleBtn.addClass("private");
      $toggleText.text("Private");
      $publicProfileBtn.hide();
    }
  }

  // Apply theme to document
  function applyTheme(theme) {
    if (theme === "auto") {
      // Use system preference
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      $("html").attr("data-theme", prefersDark ? "dark" : "light");

      // Listen for system theme changes
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (localStorage.getItem("theme") === "auto") {
          $("html").attr("data-theme", e.matches ? "dark" : "light");
        }
      });
    } else {
      $("html").attr("data-theme", theme);
    }
  }

  // Update button text based on current theme
  function updateThemeButtonText() {
    $themeToggleBtn.text(
      THEMES[currentThemeIndex].charAt(0).toUpperCase() + THEMES[currentThemeIndex].slice(1)
    );
  }

  // Initialize theme from localStorage or default to auto
  function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "auto";
    currentThemeIndex = THEMES.indexOf(savedTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0;
    applyTheme(THEMES[currentThemeIndex]);
    updateThemeButtonText();
  }

  // Footer click functionality
  $(".footer").on("click", function(e) {
    // Don't toggle if clicking on the zlyfer link
    if ($(e.target).hasClass("footer-link") || $(e.target).closest(".footer-link").length > 0) {
      return;
    }

    const $footer = $(this);
    const isSticky = !$footer.hasClass("bottom-only");

    if (isSticky) {
      $footer.addClass("bottom-only");
      // Save preference as cookie (expires in 1 year)
      document.cookie = "footerSticky=false; max-age=31536000; path=/";
    } else {
      $footer.removeClass("bottom-only");
      // Save preference as cookie (expires in 1 year)
      document.cookie = "footerSticky=true; max-age=31536000; path=/";
    }
  });

  // Load footer preference from cookie on page load
  function loadFooterPreference() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'footerSticky' && value === 'false') {
        $(".footer").addClass("bottom-only");
        break;
      }
    }
  }

  // Initialize footer preference
  loadFooterPreference();
});
