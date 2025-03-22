// API base URL - change this to your actual API URL
const API_BASE_URL = "https://api.zlyfer.net/lolarena";
let currentUser = null;
let champList = [];

// DOM elements
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const championGridContainer = document.getElementById("champion-grid-container");
  const usernameDisplay = document.getElementById("username-display");
  const countInfo = document.getElementById("count-info");
  const mainGrid = document.getElementById("main-grid");
  const logoutBtn = document.getElementById("logout-btn");
  const searchBar = document.querySelector(".search-bar");
  const clearSearchBtn = document.querySelector(".clear-search-btn");
  const filterButtons = document.querySelectorAll(".filter-button");
  const themeToggleBtn = document.getElementById("theme-toggle");

  // Theme variables
  const THEMES = ["auto", "light", "dark"];
  let currentThemeIndex = 0;
  let currentFilter = "all";

  // Init - check if user is logged in from localStorage
  initializeApp();

  function initializeApp() {
    // Load user from localStorage if available
    const savedUser = localStorage.getItem("lolArenaUser");
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        fetchChampions();
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
  document.getElementById("login-button").addEventListener("click", handleLogin);

  // Add keyboard event listeners for Enter key on login inputs
  document.getElementById("username").addEventListener("keyup", function (event) {
    if (event.key === "Enter") handleLogin();
  });

  document.getElementById("password").addEventListener("keyup", function (event) {
    if (event.key === "Enter") handleLogin();
  });

  // Handle login process
  function handleLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Validate inputs
    if (!username || !password) {
      loginError.textContent = "Please enter both username and password";
      loginError.style.display = "block";
      return;
    }

    fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          currentUser = data.user;
          localStorage.setItem("lolArenaUser", JSON.stringify(currentUser));
          fetchChampions();
        } else {
          loginError.textContent = data.message || "Login failed";
          loginError.style.display = "block";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        loginError.textContent = "An error occurred. Please try again.";
        loginError.style.display = "block";
      });
  }

  // Logout button
  logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("lolArenaUser");
    currentUser = null;
    showLoginForm();
  });

  // Fetch champions list
  function fetchChampions() {
    fetch(`${API_BASE_URL}/champions`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          champList = data.champions;
          renderChampionGrid();
          showChampionGrid();
        } else {
          console.error("Error fetching champions:", data.message);
          loginError.textContent = "Error loading champions. Please try again.";
          loginError.style.display = "block";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        loginError.textContent = "An error occurred. Please try again.";
        loginError.style.display = "block";
      });
  }

  // Render champion grid
  function renderChampionGrid() {
    mainGrid.innerHTML = "";

    champList.forEach((champ) => {
      const isOwned = currentUser.champs.includes(champ);

      // Process champion name for URL
      let bgChampName = processChampionName(champ);

      const card = document.createElement("div");
      card.className = `champ-card ${isOwned ? "owned" : ""}`;
      card.dataset.champ = champ;
      card.style.backgroundImage = `url('http://ddragon.leagueoflegends.com/cdn/img/champion/loading/${bgChampName}_0.jpg')`;

      card.innerHTML = `
        <div class="overlay"></div>
        <div class="checkmark">✓</div>
        <div class="loading-spinner"></div>
        <div class="champ-name">${champ}</div>
      `;

      card.addEventListener("click", function () {
        toggleChampion(card, champ);
      });

      mainGrid.appendChild(card);
    });

    // Update user display
    usernameDisplay.textContent = currentUser.username;
    countInfo.textContent = `${currentUser.champs.length}/${champList.length}`;

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
  function toggleChampion(card, champName) {
    // Don't allow clicking if already in loading state
    if (card.classList.contains("loading")) {
      return;
    }

    // Set loading state
    const wasOwned = card.classList.contains("owned");
    card.classList.remove("owned");
    card.classList.add("loading");

    fetch(`${API_BASE_URL}/toggle-champion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `userId=${currentUser.id}&championName=${encodeURIComponent(champName)}`,
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove loading state
        card.classList.remove("loading");

        if (data.success) {
          // Update currentUser.champs with the new list
          currentUser.champs = data.champions;
          localStorage.setItem("lolArenaUser", JSON.stringify(currentUser));

          // Toggle the owned class based on the new state
          if (wasOwned) {
            card.classList.remove("owned");
          } else {
            card.classList.add("owned");
          }

          // Update counter
          countInfo.textContent = `${currentUser.champs.length}/${champList.length}`;

          // Re-apply current filter after state change
          applyFilters();
        } else {
          console.error("Error toggling champion:", data.message);
          // Restore previous state
          if (wasOwned) {
            card.classList.add("owned");
          }
          alert("Error: " + (data.message || "Failed to update champion"));
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        // Remove loading state and restore previous state
        card.classList.remove("loading");
        if (wasOwned) {
          card.classList.add("owned");
        }
        alert("Request failed. Please check your connection.");
      });
  }

  /* ----- UI Functions ----- */

  function showLoginForm() {
    loginForm.style.display = "block";
    championGridContainer.style.display = "none";
    loginError.style.display = "none";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  }

  function showChampionGrid() {
    loginForm.style.display = "none";
    championGridContainer.style.display = "block";
  }

  // Filter buttons click handler
  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Update active button
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Set current filter
      currentFilter = this.dataset.filter;

      // Apply filters
      applyFilters();
    });
  });

  // Search input handler
  searchBar.addEventListener("input", applyFilters);

  // Clear search button handler
  clearSearchBtn.addEventListener("click", function () {
    searchBar.value = "";
    applyFilters();
    searchBar.focus();
  });

  // Apply both search and ownership filters
  function applyFilters() {
    const searchTerm = searchBar.value.toLowerCase();

    document.querySelectorAll(".champ-card").forEach((card) => {
      const champName = card.dataset.champ.toLowerCase();
      const isOwned = card.classList.contains("owned");

      // Determine visibility based on filter and search
      const showBasedOnFilter =
        currentFilter === "all" ||
        (currentFilter === "owned" && isOwned) ||
        (currentFilter === "unowned" && !isOwned);

      const matchesSearch = champName.includes(searchTerm);

      // Apply combined filter
      card.classList.toggle("filtered", !(showBasedOnFilter && matchesSearch));
    });
  }

  // Theme toggle functionality
  themeToggleBtn.addEventListener("click", function () {
    currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
    const newTheme = THEMES[currentThemeIndex];
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
    updateThemeButtonText();
  });

  // Apply theme to document
  function applyTheme(theme) {
    if (theme === "auto") {
      // Use system preference
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");

      // Listen for system theme changes
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (localStorage.getItem("theme") === "auto") {
          document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
        }
      });
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  // Update button text based on current theme
  function updateThemeButtonText() {
    themeToggleBtn.textContent =
      THEMES[currentThemeIndex].charAt(0).toUpperCase() + THEMES[currentThemeIndex].slice(1);
  }

  // Initialize theme from localStorage or default to auto
  function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "auto";
    currentThemeIndex = THEMES.indexOf(savedTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0;
    applyTheme(THEMES[currentThemeIndex]);
    updateThemeButtonText();
  }
});
