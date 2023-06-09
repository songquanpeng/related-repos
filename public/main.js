let settings = {
  range: 20,
  token: ""
}

let currentRepo = "";
let sorted = [];

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
    remainTimes--;
  }
  let idx = repos.findIndex((repo) => {
    return repo.url === target;
  });
  let range = Math.ceil(settings.range / 2);
  return repos.slice(Math.max(0, idx - range), Math.min(repos.length, idx + range));
}

function extractRepo(repo) {
  let parts = repo.split("/");
  let owner = parts[parts.length - 2];
  let name = parts[parts.length - 1];
  return {owner, name}
}

async function search(repo) {
  if (repo.endsWith("/")) {
    repo = repo.slice(0, -1);
  }
  currentRepo = repo;
  let {owner, name} = extractRepo(repo);
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
    if (repo !== currentRepo) {
      return;
    }
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
    sorted = Array.from(totalStars.values()).sort((a, b) => {
      if (b.count === a.count) {
        return b.stargazerCount - a.stargazerCount;
      }
      return b.count - a.count;
    });
    let html = "";
    for (let i = 0; i < Math.min(sorted.length, settings.range); i++) {
      let repo = sorted[i];
      html += `<tr>
                        <td><a href="${repo.url}" target="_blank">${repo.name}</a> <a href="./?repo=${repo.url}" target="_blank">🔍</a></td>
                        <td>${repo.count}</td>
                        <td>${repo.stargazerCount}</td>
                        <td>${repo.primaryLanguage ? repo.primaryLanguage.name : ""}</td>
                    </tr>`;
    }
    if (repo !== currentRepo) {
      return;
    }
    document.getElementById("resultTableBody").innerHTML = html;
    document.getElementById("progress").value = i / users.length * 100;
  }
  document.getElementById("progress").value = 100;
}

function exportResult() {
  let markdown = "|Name|Count|Stars|Language|\n|---|---|---|---|\n";
  for (let i = 0; i < Math.min(sorted.length, settings.range); i++) {
    let repo = sorted[i];
    markdown += `|[${repo.name}](${repo.url})|${repo.count}|${repo.stargazerCount}|${repo.primaryLanguage ? repo.primaryLanguage.name : ""}|\n`;
  }
  let {owner, name} = extractRepo(currentRepo);
  downloadTextAsFile(markdown, `${owner}-${name}.md`);
}

function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

async function init() {
  loadSettings();
  // get query
  let query = new URLSearchParams(window.location.search);
  let repo = query.get("repo");
  if (repo) {
    document.getElementById("searchInput").value = repo;
    await search(repo);
  }
}

