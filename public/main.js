let settings = {
    range: 20,
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
    settings = {
        range: document.getElementById("rangeInput").value,
        token: document.getElementById("tokenInput").value,
    }
    localStorage.setItem("settings", JSON.stringify(settings));
    closeModal("settingsModal");
}

function loadSettings() {
    let settings_ = JSON.parse(localStorage.getItem("settings"));
    if (settings_) {
        settings = settings_;
        document.getElementById("rangeInput").value = settings.range;
        document.getElementById("tokenInput").value = settings.token;
    }
}

async function getUserStars(username, target) {
    let repos = [];
    let remainTimes = 3;
    const variables = {
        username: username,
        after: null,
    };
    while (remainTimes > 0) {
        let res = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${settings.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: `query($username: String!, $after: String) {
                                user(login: $username) {
                                  starredRepositories(first: 100, after: $after, orderBy: {field: STARRED_AT, direction: DESC}) {
                                    pageInfo {
                                      endCursor
                                      hasNextPage
                                    }
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
                , variables
            })
        });
        let data = await res.json();
        const pageInfo = data.data.user.starredRepositories.pageInfo;
        if (pageInfo.hasNextPage) {
            variables.after = pageInfo.endCursor;
        }
        data.data.user.starredRepositories.edges.forEach((edge) => {
            if (edge.node.url === target && remainTimes > 1) {
                remainTimes = 1;
            }
            repos.push(edge.node);
        });
        remainTimes --;
    }
    let idx = repos.findIndex((repo) => {
        return repo.url === target;
    });
    let range = Math.ceil(settings.range / 2);
    return repos.slice(Math.max(0, idx - range), Math.min(repos.length, idx + range));
}

async function search(repo) {
    if (repo.endsWith("/")) {
        repo = repo.slice(0, -1);
    }
    let parts = repo.split("/");
    let owner = parts[parts.length - 2];
    let name = parts[parts.length - 1];
    document.getElementById("progress").style.display = "block";
    // document.getElementById("resultTable").style.display = "block";
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
        let stars = await getUserStars(user, repo);
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
        for (let i = 0; i < Math.min(sorted.length, settings.range); i++) {
            let repo = sorted[i];
            html += `<tr>
                        <td><a href="${repo.url}" target="_blank">${repo.name}</a></td>
                        <td>${repo.count}</td>
                        <td>${repo.stargazerCount}</td>
                        <td>${repo.primaryLanguage ? repo.primaryLanguage.name : ""}</td>
                    </tr>`;
        }
        document.getElementById("resultTableBody").innerHTML = html;
        document.getElementById("progress").value = i / users.length * 100;
    }
    document.getElementById("progress").value = 100;
}

function init() {
    loadSettings();
}

