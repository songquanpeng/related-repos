let settings = {
    range: 15,
    token: ""
}

function showModal(id) {
    document.getElementById(id).className = "modal is-active";
    if (id === "settingsModal") {
        loadSettings();
    }
}

function closeModal(id) {
    document.getElementById(id).className = "modal";
}

function saveSettings() {
    localStorage.setItem("settings", JSON.stringify({
        range: document.getElementById("rangeInput").value,
        token: document.getElementById("tokenInput").value
    }));
    closeModal("settingsModal");
}

function loadSettings() {
    let settings_ = JSON.parse(localStorage.getItem("settings"));
    console.log(settings_)
    if (settings_) {
        settings = settings_;
        document.getElementById("rangeInput").value = settings.range;
        document.getElementById("tokenInput").value = settings.token;
    }
}

async function getUserStars(username) {
    let res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${settings.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: `  query {
    user(login: "${username}") {
      starredRepositories(first: 100, orderBy: {field: STARRED_AT, direction: DESC}) {
        edges {
          node {
            name
            url
            stargazerCount
            primaryLanguage {
              name
            }
          }
        }
      }
    }
  }`
        })
    });
    let data = await res.json();
    let repos = [];
    data.data.user.starredRepositories.edges.forEach((edge) => {
        repos.push(edge.node);
    });
    return repos;
}

async function search(repo) {
    if (repo.endsWith("/")) {
        repo = repo.slice(0, -1);
    }
    let parts = repo.split("/");
    let owner = parts[parts.length - 2];
    let name = parts[parts.length - 1];
    let res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${settings.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: `query {
                        repository(owner: "${owner}", name: "${name}") {
                          stargazers(first: 100, orderBy: {field: STARRED_AT, direction: DESC}) {
                            edges {
                              node {
                                login
                              }
                            }
                          }
                        }
                      }`
        })
    });
    let data = await res.json();
    let users = [];
    data.data.repository.stargazers.edges.forEach((edge) => {
        users.push(edge.node.login);
    });
    let totalStars = new Map();
    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        let stars = await getUserStars(user);
        stars.forEach((star) => {
            if (totalStars.get(star.name)) {
                star.count = totalStars.get(star.name).count + 1;
                totalStars.set(star.name, star);
            } else {
                star.count = 1;
                totalStars.set(star.name, star);
            }
        });
        let sorted = Array.from(totalStars.values()).sort((a, b) => {
            if (b.count === a.count) {
                return b.stargazerCount - a.stargazerCount;
            }
            return b.count - a.count;
        });
        let html = "";
        for (let i = 0; i < settings.range; i++) {
            let repo = sorted[i];
            html += `<tr>
                        <td><a href="${repo.url}" target="_blank">${repo.name}</a></td>
                        <td>${repo.count}</td>
                        <td>${repo.stargazerCount}</td>
                        <td>${repo.primaryLanguage ? repo.primaryLanguage.name : ""}</td>
                    </tr>`;
        }
        document.getElementById("resultTable").innerHTML = html;
    }
}

function init() {
    loadSettings();
}

