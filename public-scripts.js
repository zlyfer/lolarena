// Public Profile JavaScript - Stream Overlay
let champList = [];
let currentUsername = null;
let refreshInterval = null;

$(document).ready(function () {
    // Get username from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');

    if (!username) {
        showError("No username provided");
        return;
    }

    currentUsername = username;

    // Initialize the public profile
    initializePublicProfile(username);

    // Set up auto-refresh every minute
    startAutoRefresh();

    // Add click handler for profile card toggle
    $('.profile-card').on('click', function() {
        $(this).toggleClass('highlighted');
    });
});

function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    // Set up new interval - refresh every 60 seconds
    refreshInterval = setInterval(function() {
        if (currentUsername) {
            console.log('Auto-refreshing profile data...');
            fetchPublicProfile(currentUsername);
        }
    }, 60000); // 60 seconds = 1 minute
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function initializePublicProfile(username) {
    // Show loading state
    $('.progress-fill').css('width', '0%');
    $('.progress-text').text('0/0');
    $('#public-champion-grid').html('<div class="loading">Loading champion collection...</div>');

    // Fetch user's public data
    fetchPublicProfile(username);
}

function fetchPublicProfile(username) {
    $.ajax({
        url: `${API_BASE_URL}/user/${username}`,
        method: "GET",
        success: function (data) {
            if (data.success) {
                // User is public and found, render their profile
                renderPublicProfile(data.user);
            } else {
                showError(data.message || "Failed to load profile");
            }
        },
        error: function (xhr, status, error) {
            console.error("Error fetching public profile:", error);
            if (xhr.status === 403) {
                showError("This profile is private");
            } else if (xhr.status === 404) {
                showError("User not found");
            } else {
                showError("Failed to load profile");
            }
        }
    });
}

function renderPublicProfile(user) {
    // First fetch the champion list to get total count
    $.ajax({
        url: `${API_BASE_URL}/champions`,
        method: "GET",
        success: function (data) {
            if (data.success) {
                champList = data.champions;

                // Calculate and update progress
                const progressPercent = Math.round((user.champs.length / champList.length) * 100);
                $('.progress-fill').css('width', `${progressPercent}%`);
                $('.progress-text').text(`${user.champs.length}/${champList.length}`);

                // Render only the last 5 unlocked champions
                renderLastFiveChampions(user.champs);
            } else {
                // If we can't get total count, just show owned count
                renderLastFiveChampions(user.champs);
            }
        },
        error: function (xhr, status, error) {
            console.error("Error fetching champions:", error);
            // If we can't get total count, just show owned count
            renderLastFiveChampions(user.champs);
        }
    });
}

function renderLastFiveChampions(ownedChampions) {
    // Get only the last 5 unlocked champions and reverse the order
    const lastFiveOwned = ownedChampions.slice(-5).reverse();

    // Render champion grid
    const $grid = $('#public-champion-grid');
    $grid.empty();

    // If less than 5 champions owned, show all of them
    const championsToShow = lastFiveOwned.length < 5 ? lastFiveOwned : lastFiveOwned;

    championsToShow.forEach((champ) => {
        // Process champion name for URL
        let bgChampName = processChampionName(champ);

        const $card = $("<div>")
            .addClass("champ-card owned")
            .attr("data-champ", champ)
            .css("backgroundImage", `url('http://ddragon.leagueoflegends.com/cdn/img/champion/loading/${bgChampName}_0.jpg')`);

        $card.html(`
            <div class="overlay"></div>
        `);

        $grid.append($card);
    });

    // If no champions owned, show a message
    if (ownedChampions.length === 0) {
        $grid.html('<div class="error-message">No champions unlocked yet</div>');
    }
}

// Process champion name for URL (same as in main scripts.js)
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

function showError(message) {
    $('.progress-fill').css('width', '0%');
    $('.progress-text').text('0/0');
    $('#public-champion-grid').html(`<div class="error-message">${message}</div>`);
}

// Clean up interval when page is unloaded
$(window).on('beforeunload', function() {
    stopAutoRefresh();
});