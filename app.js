(function () {
  "use strict";

  var STORAGE_KEY = "basketballTeamGenerator.players.v1";
  var MATCHUP_KEY = "basketballTeamGenerator.latestMatchup.v1";
  var THEME_KEY = "basketballTeamGenerator.theme.v1";
  var ATTRIBUTE_FIELDS = ["shooting", "defense", "aggressiveness", "handling", "passing", "rebounding", "stamina", "speed"];
  var FORM_FIELDS = ["name", "height", "weight", "size"].concat(ATTRIBUTE_FIELDS);
  var CAPABILITY_VALUES = [20, 40, 60, 80, 95];
  var state = {
    players: [],
    selectedIds: new Set(),
    matchup: null,
    search: "",
    leaderboardSearch: "",
    leaderboardSort: "rating",
    activePage: "players",
    darkMode: false
  };

  var demoPlayers = [
    ["Ari", "5'10\"", 165, "Guard", 86, 62, 71, 84, 76, 43, 81, 82],
    ["Maya", "6'0\"", 150, "Wing", 78, 83, 77, 74, 80, 69, 85, 79],
    ["Noah", "6'4\"", 205, "Forward", 65, 84, 80, 61, 68, 86, 73, 64],
    ["Jalen", "6'2\"", 190, "Wing", 88, 70, 82, 79, 72, 66, 78, 77],
    ["Sam", "5'9\"", 155, "Guard", 74, 67, 65, 83, 82, 41, 88, 86],
    ["Chris", "6'6\"", 225, "Big", 58, 88, 75, 52, 59, 92, 68, 57],
    ["Taylor", "6'1\"", 175, "Flexible", 71, 76, 72, 72, 79, 74, 76, 75],
    ["Devin", "6'3\"", 198, "Forward", 69, 79, 84, 65, 70, 82, 74, 70]
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function load() {
    try {
      state.players = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      state.matchup = JSON.parse(localStorage.getItem(MATCHUP_KEY)) || null;
      state.darkMode = localStorage.getItem(THEME_KEY) === "dark";
      if (state.matchup && Array.isArray(state.matchup.selectedIds)) {
        state.selectedIds = new Set(state.matchup.selectedIds);
      }
    } catch (error) {
      state.players = [];
      state.matchup = null;
      state.selectedIds = new Set();
      showToast("Saved data could not be loaded. Starting fresh.");
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.players));
    localStorage.setItem(THEME_KEY, state.darkMode ? "dark" : "light");
    if (state.matchup) {
      localStorage.setItem(MATCHUP_KEY, JSON.stringify(state.matchup));
    } else {
      localStorage.removeItem(MATCHUP_KEY);
    }
  }

  function baseStats() {
    return {
      games: 0,
      wins: 0,
      losses: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0
    };
  }

  function normalizePlayer(raw) {
    var player = {
      id: raw.id || uid(),
      name: String(raw.name || "").trim(),
      height: String(raw.height || "").trim(),
      weight: raw.weight === "" || raw.weight == null ? "" : toNumber(raw.weight, ""),
      size: raw.size || "Flexible",
      stats: Object.assign(baseStats(), raw.stats || {})
    };

    ATTRIBUTE_FIELDS.forEach(function (field) {
      player[field] = Math.round(clamp(toNumber(raw[field], 50), 1, 100));
    });
    player.overall = raw.overall == null
      ? calculateOverall(player)
      : Math.round(clamp(toNumber(raw.overall, calculateOverall(player)), 1, 100));

    return player;
  }

  function calculateOverall(player) {
    var rating =
      player.shooting * 0.16 +
      player.defense * 0.17 +
      player.aggressiveness * 0.1 +
      player.handling * 0.13 +
      player.passing * 0.12 +
      player.rebounding * 0.13 +
      player.stamina * 0.1 +
      player.speed * 0.09;
    return Math.round(clamp(rating, 1, 100));
  }

  function effectiveScore(player) {
    var sizeBonus = {
      Guard: 0.6,
      Wing: 1.2,
      Forward: 1.4,
      Big: 1.6,
      Flexible: 1
    }[player.size] || 1;
    var weightBonus = player.weight ? clamp((Number(player.weight) - 170) / 90, -1.5, 2.3) : 0;
    var score =
      player.overall * 0.24 +
      player.shooting * 0.15 +
      player.defense * 0.16 +
      player.handling * 0.1 +
      player.passing * 0.1 +
      player.rebounding * 0.11 +
      player.stamina * 0.07 +
      player.speed * 0.05 +
      player.aggressiveness * 0.05 +
      sizeBonus +
      weightBonus;
    return Math.round(score * 10) / 10;
  }

  function formToPlayer() {
    var data = {};
    FORM_FIELDS.forEach(function (field) {
      data[field] = $(field).value;
    });
    data.id = $("playerId").value || uid();
    return normalizePlayer(data);
  }

  function fillForm(player) {
    switchPage("players");
    $("playerId").value = player.id;
    FORM_FIELDS.forEach(function (field) {
      if (ATTRIBUTE_FIELDS.includes(field)) {
        $(field).value = nearestCapabilityValue(player[field]);
      } else {
        $(field).value = player[field];
      }
    });
    $("savePlayerButton").textContent = "Update Player";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    $("playerForm").reset();
    $("playerId").value = "";
    ATTRIBUTE_FIELDS.forEach(function (field) {
      $(field).value = 60;
    });
    $("savePlayerButton").textContent = "Save Player";
  }

  function nearestCapabilityValue(value) {
    var numeric = toNumber(value, 60);
    return CAPABILITY_VALUES.reduce(function (nearest, option) {
      return Math.abs(option - numeric) < Math.abs(nearest - numeric) ? option : nearest;
    }, CAPABILITY_VALUES[0]);
  }

  function render() {
    applyTheme();
    renderSummary();
    renderRoster();
    renderSelectionList();
    renderMatchup();
    renderStats();
    renderLeaderboard();
    save();
  }

  function renderSummary() {
    var selected = selectedPlayers();
    var average = state.players.length
      ? Math.round(state.players.reduce(function (sum, player) { return sum + player.overall; }, 0) / state.players.length)
      : 0;
    $("summaryPlayers").textContent = state.players.length;
    $("summarySelected").textContent = selected.length;
    $("summaryAverage").textContent = average;
  }

  function renderRoster() {
    var list = $("playerList");
    var query = state.search.trim().toLowerCase();
    var players = state.players
      .slice()
      .sort(function (a, b) { return effectiveScore(b) - effectiveScore(a); })
      .filter(function (player) {
        return !query || player.name.toLowerCase().includes(query) || player.size.toLowerCase().includes(query);
      });

    if (!players.length) {
      list.innerHTML = '<div class="empty">No players match this roster view.</div>';
      return;
    }

    list.innerHTML = players.map(function (player) {
      var stats = player.stats || baseStats();
      return [
        '<article class="player-card">',
        '<div class="player-top">',
        '<div><h3 class="player-name">' + escapeHtml(player.name) + '</h3>',
        '<div class="tags">',
        '<span class="tag">' + escapeHtml(player.size) + '</span>',
        '<span class="tag">' + escapeHtml(player.height || "Height n/a") + '</span>',
        '<span class="tag">' + (player.weight ? player.weight + " lb" : "Weight n/a") + '</span>',
        '<span class="tag">' + stats.games + ' games</span>',
        '</div></div>',
        '<span class="rating-pill">' + effectiveScore(player) + '</span>',
        '</div>',
        '<div class="tags">',
        '<span class="tag">Shoot ' + player.shooting + '</span>',
        '<span class="tag">Def ' + player.defense + '</span>',
        '<span class="tag">Pass ' + player.passing + '</span>',
        '<span class="tag">Reb ' + player.rebounding + '</span>',
        '<span class="tag">OVR ' + player.overall + '</span>',
        '</div>',
        '<div class="player-actions">',
        '<button type="button" class="small-btn blue" data-action="edit" data-id="' + player.id + '">Edit</button>',
        '<button type="button" class="small-btn danger" data-action="delete" data-id="' + player.id + '">Delete</button>',
        '</div>',
        '</article>'
      ].join("");
    }).join("");
  }

  function renderSelectionList() {
    var list = $("selectionList");
    if (!list) {
      return;
    }
    var selectAllButton = $("selectAllButton");
    if (selectAllButton) {
      var allSelected = state.players.length && state.players.every(function (player) {
        return state.selectedIds.has(player.id);
      });
      selectAllButton.textContent = allSelected ? "Deselect All" : "Select All";
    }

    if (!state.players.length) {
      list.innerHTML = '<div class="empty" style="grid-column:1/-1;">Add players on the Players page before making teams.</div>';
      return;
    }

    list.innerHTML = state.players
      .slice()
      .sort(function (a, b) { return effectiveScore(b) - effectiveScore(a); })
      .map(function (player) {
        var selected = state.selectedIds.has(player.id);
        return [
          '<article class="selection-card' + (selected ? " selected" : "") + '" data-id="' + player.id + '" role="button" tabindex="0">',
          '<div class="player-top">',
          '<div><h3 class="player-name">' + escapeHtml(player.name) + '</h3>',
          '<div class="tags">',
          '<span class="tag">' + escapeHtml(player.size) + '</span>',
          '<span class="tag">OVR ' + player.overall + '</span>',
          '<span class="tag">' + ((player.stats || baseStats()).games) + ' games</span>',
          '</div></div>',
          '<span class="rating-pill">' + effectiveScore(player) + '</span>',
          '</div>',
          '</article>'
        ].join("");
      }).join("");
  }

  function renderMatchup() {
    var notice = $("notice");
    var fairness = $("fairness");
    var teams = $("teams");
    notice.className = "notice";
    notice.textContent = "";

    if (!state.matchup || !state.matchup.teams) {
      fairness.innerHTML = "";
      teams.innerHTML = '<div class="empty" style="grid-column:1/-1;">Select at least two players and generate teams.</div>';
      return;
    }

    var teamA = hydrateTeam(state.matchup.teams[0]);
    var teamB = hydrateTeam(state.matchup.teams[1]);
    var scoreA = teamTotal(teamA);
    var scoreB = teamTotal(teamB);
    var avgA = teamA.length ? scoreA / teamA.length : 0;
    var avgB = teamB.length ? scoreB / teamB.length : 0;
    var gap = Math.abs(scoreA - scoreB);

    fairness.innerHTML = [
      '<div class="metric"><strong>' + gap.toFixed(1) + '</strong><span>Total Gap</span></div>',
      '<div class="metric"><strong>' + avgA.toFixed(1) + '</strong><span>Team A Avg</span></div>',
      '<div class="metric"><strong>' + avgB.toFixed(1) + '</strong><span>Team B Avg</span></div>'
    ].join("");

    teams.innerHTML = renderTeam("Team A", teamA, scoreA) + renderTeam("Team B", teamB, scoreB);
  }

  function renderTeam(name, players, score) {
    return [
      '<section class="team">',
      '<h3><span>' + name + '</span><span>' + score.toFixed(1) + '</span></h3>',
      '<ul>',
      players.map(function (player) {
        return '<li><span>' + escapeHtml(player.name) + '</span><strong>' + effectiveScore(player) + '</strong></li>';
      }).join("") || '<li><span>No players</span><strong>0</strong></li>',
      '</ul>',
      '</section>'
    ].join("");
  }

  function renderStats() {
    var area = $("statsArea");
    if (!state.matchup || !state.matchup.teams) {
      area.innerHTML = '<div class="empty">Generate teams before entering game stats.</div>';
      return;
    }

    if (state.matchup.statsSaved) {
      area.innerHTML = '<div class="empty">Stats for this matchup are saved. Generate or reshuffle teams to record another game.</div>';
      return;
    }

    var players = hydrateTeam(state.matchup.teams[0]).concat(hydrateTeam(state.matchup.teams[1]));
    if (!players.length) {
      area.innerHTML = '<div class="empty">Generated players could not be found.</div>';
      return;
    }

    area.innerHTML = [
      '<div class="stats-table-wrap"><table>',
      '<thead><tr><th>Player</th><th>Team</th><th>Result</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>TO</th></tr></thead>',
      '<tbody>',
      players.map(function (player) {
        var teamName = teamNameFor(player.id);
        return [
          '<tr data-player="' + player.id + '">',
          '<td><strong>' + escapeHtml(player.name) + '</strong></td>',
          '<td>' + teamName + '</td>',
          '<td><select data-stat="result"><option value="win">Win</option><option value="loss">Loss</option></select></td>',
          statInput("points"),
          statInput("rebounds"),
          statInput("assists"),
          statInput("steals"),
          statInput("blocks"),
          statInput("turnovers"),
          '</tr>'
        ].join("");
      }).join(""),
      '</tbody></table></div>'
    ].join("");
  }

  function renderLeaderboard() {
    var area = $("leaderboard");
    if (!area) {
      return;
    }

    var query = state.leaderboardSearch.trim().toLowerCase();
    var players = state.players
      .slice()
      .filter(function (player) {
        return !query || player.name.toLowerCase().includes(query) || player.size.toLowerCase().includes(query);
      })
      .sort(function (a, b) {
        return leaderboardValue(b, state.leaderboardSort) - leaderboardValue(a, state.leaderboardSort);
      });

    if (!players.length) {
      area.innerHTML = '<div class="empty">No leaderboard results yet.</div>';
      return;
    }

    area.innerHTML = [
      '<div class="stats-table-wrap"><table>',
      '<thead><tr><th>Rank</th><th>Player</th><th>Rating</th><th>Overall</th><th>Games</th><th>W-L</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>TO</th></tr></thead>',
      '<tbody>',
      players.map(function (player, index) {
        var stats = player.stats || baseStats();
        return [
          '<tr>',
          '<td><span class="rank">' + (index + 1) + '</span></td>',
          '<td><strong>' + escapeHtml(player.name) + '</strong><br><span class="tag">' + escapeHtml(player.size) + '</span></td>',
          '<td><strong>' + effectiveScore(player) + '</strong></td>',
          '<td>' + player.overall + '</td>',
          '<td>' + stats.games + '</td>',
          '<td>' + stats.wins + '-' + stats.losses + '</td>',
          '<td>' + stats.points + '</td>',
          '<td>' + stats.rebounds + '</td>',
          '<td>' + stats.assists + '</td>',
          '<td>' + stats.steals + '</td>',
          '<td>' + stats.blocks + '</td>',
          '<td>' + stats.turnovers + '</td>',
          '</tr>'
        ].join("");
      }).join(""),
      '</tbody></table></div>'
    ].join("");
  }

  function leaderboardValue(player, sort) {
    var stats = player.stats || baseStats();
    if (sort === "rating") {
      return effectiveScore(player);
    }
    if (sort === "overall") {
      return player.overall;
    }
    return stats[sort] || 0;
  }

  function statInput(name) {
    return '<td><input data-stat="' + name + '" type="number" min="0" max="200" value="0"></td>';
  }

  function hydrateTeam(ids) {
    return (ids || []).map(function (id) {
      return state.players.find(function (player) { return player.id === id; });
    }).filter(Boolean);
  }

  function selectedPlayers() {
    return state.players.filter(function (player) {
      return state.selectedIds.has(player.id);
    });
  }

  function teamTotal(players) {
    return players.reduce(function (sum, player) {
      return sum + effectiveScore(player);
    }, 0);
  }

  function teamNameFor(playerId) {
    if (!state.matchup || !state.matchup.teams) {
      return "";
    }
    return state.matchup.teams[0].includes(playerId) ? "A" : "B";
  }

  function generateTeams() {
    var players = selectedPlayers();
    if (players.length < 2) {
      showNotice("Select at least two players before generating teams.");
      return;
    }

    var best = null;
    for (var i = 0; i < 600; i += 1) {
      var shuffled = shuffle(players.slice()).sort(function (a, b) {
        return effectiveScore(b) - effectiveScore(a) + (Math.random() - 0.5) * 5;
      });
      var teams = [[], []];
      shuffled.forEach(function (player) {
        var firstFull = teams[0].length >= Math.ceil(players.length / 2);
        var secondFull = teams[1].length >= Math.floor(players.length / 2);
        var target = teamTotal(teams[0]) <= teamTotal(teams[1]) ? 0 : 1;
        if ((target === 0 && firstFull) || (target === 1 && secondFull)) {
          target = target === 0 ? 1 : 0;
        }
        teams[target].push(player);
      });
      var gap = Math.abs(teamTotal(teams[0]) - teamTotal(teams[1]));
      if (!best || gap < best.gap) {
        best = { teams: teams, gap: gap };
      }
    }

    state.matchup = {
      generatedAt: new Date().toISOString(),
      selectedIds: players.map(function (player) { return player.id; }),
      statsSaved: false,
      teams: best.teams.map(function (team) {
        return team.map(function (player) { return player.id; });
      })
    };
    render();
    switchPage("teams-page");
    showToast("Teams generated with a " + best.gap.toFixed(1) + " rating gap.");
  }

  function shuffle(items) {
    for (var i = items.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }
    return items;
  }

  function saveGameStats() {
    if (!state.matchup || !state.matchup.teams) {
      showToast("Generate teams before saving stats.");
      return;
    }

    if (state.matchup.statsSaved) {
      showToast("Stats for this matchup have already been saved.");
      return;
    }

    var rows = Array.from(document.querySelectorAll("#statsArea tr[data-player]"));
    if (!rows.length) {
      showToast("No stat rows are available.");
      return;
    }

    rows.forEach(function (row) {
      var player = state.players.find(function (item) { return item.id === row.dataset.player; });
      if (!player) {
        return;
      }

      var stats = {};
      row.querySelectorAll("[data-stat]").forEach(function (input) {
        stats[input.dataset.stat] = input.value;
      });

      var points = clamp(toNumber(stats.points, 0), 0, 200);
      var rebounds = clamp(toNumber(stats.rebounds, 0), 0, 80);
      var assists = clamp(toNumber(stats.assists, 0), 0, 80);
      var steals = clamp(toNumber(stats.steals, 0), 0, 40);
      var blocks = clamp(toNumber(stats.blocks, 0), 0, 40);
      var turnovers = clamp(toNumber(stats.turnovers, 0), 0, 80);
      var won = stats.result === "win";
      var ratingDelta = calculateRatingDelta({ points: points, rebounds: rebounds, assists: assists, steals: steals, blocks: blocks, turnovers: turnovers, won: won });
      player.stats = Object.assign(baseStats(), player.stats || {});
      player.stats.games += 1;
      player.stats.wins += won ? 1 : 0;
      player.stats.losses += won ? 0 : 1;
      player.stats.points += points;
      player.stats.rebounds += rebounds;
      player.stats.assists += assists;
      player.stats.steals += steals;
      player.stats.blocks += blocks;
      player.stats.turnovers += turnovers;
      player.overall = Math.round(clamp(player.overall + ratingDelta, 1, 100));
    });

    state.matchup.statsSaved = true;
    render();
    showToast("Game saved and ratings updated.");
  }

  function switchPage(pageId) {
    state.activePage = pageId;
    document.querySelectorAll(".page").forEach(function (page) {
      page.classList.toggle("active", page.id === pageId);
    });
    document.querySelectorAll("[data-page-target]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.pageTarget === pageId);
    });
  }

  function applyTheme() {
    document.body.classList.toggle("dark-mode", state.darkMode);
    var themeToggle = $("themeToggle");
    if (themeToggle) {
      themeToggle.textContent = state.darkMode ? "Light Mode" : "Dark Mode";
      themeToggle.setAttribute("aria-pressed", String(state.darkMode));
    }
  }

  function calculateRatingDelta(stats) {
    var impact =
      stats.points * 0.05 +
      stats.rebounds * 0.08 +
      stats.assists * 0.1 +
      stats.steals * 0.16 +
      stats.blocks * 0.16 -
      stats.turnovers * 0.14 +
      (stats.won ? 0.7 : -0.35) -
      1.2;
    return clamp(impact, -3, 3);
  }

  function showNotice(message) {
    var notice = $("notice");
    notice.textContent = message;
    notice.className = "notice visible";
  }

  function showToast(message) {
    var toast = $("toast");
    toast.textContent = message;
    toast.className = "toast visible";
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.className = "toast";
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function loadDemo() {
    if (state.players.length && !window.confirm("Add demo players to the current roster?")) {
      return;
    }

    demoPlayers.forEach(function (row) {
      state.players.push(normalizePlayer({
        id: uid(),
        name: row[0],
        height: row[1],
        weight: row[2],
        size: row[3],
        shooting: row[4],
        defense: row[5],
        aggressiveness: row[6],
        handling: row[7],
        passing: row[8],
        rebounding: row[9],
        stamina: row[10],
        speed: row[11]
      }));
    });
    render();
    showToast("Demo roster loaded.");
  }

  function bindEvents() {
    document.querySelectorAll("[data-page-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        switchPage(button.dataset.pageTarget);
      });
    });

    $("playerForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var player = formToPlayer();
      if (!player.name) {
        showToast("Player name is required.");
        return;
      }

      var duplicate = state.players.find(function (item) {
        return item.name.toLowerCase() === player.name.toLowerCase() && item.id !== player.id;
      });
      if (duplicate && !window.confirm("A player with this name already exists. Save anyway?")) {
        return;
      }

      var existingIndex = state.players.findIndex(function (item) { return item.id === player.id; });
      if (existingIndex >= 0) {
        player.stats = state.players[existingIndex].stats || baseStats();
        state.players[existingIndex] = player;
      } else {
        state.players.push(player);
        state.selectedIds.add(player.id);
      }

      resetForm();
      render();
      showToast("Player saved.");
    });

    $("resetFormButton").addEventListener("click", resetForm);
    $("generateButton").addEventListener("click", generateTeams);
    $("reshuffleButton").addEventListener("click", generateTeams);
    $("saveStatsButton").addEventListener("click", saveGameStats);
    $("loadDemoButton").addEventListener("click", loadDemo);
    $("themeToggle").addEventListener("click", function () {
      state.darkMode = !state.darkMode;
      render();
    });

    $("clearSelectionButton").addEventListener("click", function () {
      state.selectedIds.clear();
      state.matchup = null;
      render();
    });

    $("clearDataButton").addEventListener("click", function () {
      if (!window.confirm("Delete every saved player and stat on this device?")) {
        return;
      }
      state.players = [];
      state.selectedIds.clear();
      state.matchup = null;
      resetForm();
      render();
      showToast("Local data cleared.");
    });

    $("selectAllButton").addEventListener("click", function () {
      var allSelected = state.players.length && state.players.every(function (player) {
        return state.selectedIds.has(player.id);
      });
      if (allSelected) {
        state.selectedIds.clear();
      } else {
        state.players.forEach(function (player) {
          state.selectedIds.add(player.id);
        });
      }
      render();
    });

    $("search").addEventListener("input", function (event) {
      state.search = event.target.value;
      renderRoster();
    });

    $("leaderboardSearch").addEventListener("input", function (event) {
      state.leaderboardSearch = event.target.value;
      renderLeaderboard();
    });

    $("leaderboardSort").addEventListener("change", function (event) {
      state.leaderboardSort = event.target.value;
      renderLeaderboard();
    });

    $("selectionList").addEventListener("click", function (event) {
      var card = event.target.closest(".selection-card[data-id]");
      if (card) {
        toggleSelectedPlayer(card.dataset.id);
      }
    });

    $("selectionList").addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      var card = event.target.closest(".selection-card[data-id]");
      if (card) {
        event.preventDefault();
        toggleSelectedPlayer(card.dataset.id);
      }
    });

    $("playerList").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      var id = button.dataset.id;
      var action = button.dataset.action;
      var player = state.players.find(function (item) { return item.id === id; });
      if (!player) {
        return;
      }

      if (action === "edit") {
        fillForm(player);
      }

      if (action === "delete") {
        if (!window.confirm("Delete " + player.name + " and their saved stats?")) {
          return;
        }
        state.players = state.players.filter(function (item) { return item.id !== id; });
        state.selectedIds.delete(id);
        if (state.matchup) {
          state.matchup.teams = state.matchup.teams.map(function (team) {
            return team.filter(function (playerId) { return playerId !== id; });
          });
          state.matchup.selectedIds = state.matchup.selectedIds.filter(function (playerId) { return playerId !== id; });
        }
      }

      render();
    });
  }

  function toggleSelectedPlayer(id) {
    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
    } else {
      state.selectedIds.add(id);
    }
    state.matchup = null;
    render();
  }

  load();
  state.players = state.players.map(normalizePlayer);
  bindEvents();
  switchPage(state.activePage);
  render();
}());
