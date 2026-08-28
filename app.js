import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, browserLocalPersistence, setPersistence, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const FIREBASE_CONFIG = { apiKey: "AIzaSyCItF-Sy36VLy7dKD7yWcoCYxj9axoB6CY", authDomain: "impostor-online-77364.firebaseapp.com", projectId: "impostor-online-77364", storageBucket: "impostor-online-77364.firebasestorage.app", messagingSenderId: "560196882166", appId: "1:560196882166:web:b339a06af124bd60e166d7", measurementId: "G-W7567F17H8" };
const LOCAL_PREFIX = "impostor_room_";
const state = { mode: "firebase", db: null, user: null, roomId: null, room: null, unsub: null };
const el = (id) => document.getElementById(id);
const els = { warning: el("configWarning"), connection: el("connectionInfo"), join: el("joinPanel"), lobby: el("lobbyPanel"), game: el("gamePanel"), name: el("nameInput"), code: el("roomCodeInput"), create: el("createRoomBtn"), joinBtn: el("joinRoomBtn"), save: el("saveProfileBtn"), players: el("playersList"), lobbyInfo: el("lobbyInfo"), roomBadge: el("roomCodeBadge"), start: el("startGameBtn"), copy: el("copyCodeBtn"), jester: el("jesterToggle"), jesterChance: el("jesterChance"), executioner: el("executionerToggle"), executionerChance: el("executionerChance"), status: el("statusText"), round: el("roundValue"), key: el("keyHolderValue"), secretWord: el("secretWordValue"), badge: el("gameStatusBadge"), next: el("nextRoundBtn"), newGame: el("newGameBtn"), end: el("endGameBtn"), table: el("tablePlayers"), winner: el("winnerBanner"), toast: el("toast"), roleModal: el("roleModal"), roleTitle: el("roleModalTitle"), roleText: el("roleModalText"), roleRole: el("roleModalRole"), roleWord: el("roleModalWord"), roleVisual: el("roleModalVisual"), roleOk: el("roleModalOkBtn") };

init();
async function init() {
  els.name.value = localStorage.getItem("impostor_name") || "";
  wireEvents();
  try {
    const app = initializeApp(FIREBASE_CONFIG); state.db = getFirestore(app); state.auth = getAuth(app); void analyticsSupported().then((supported) => { if (supported) getAnalytics(app); }); showConnection("Logowanie anonimowe...");
    await setPersistence(state.auth, browserLocalPersistence); const credential = await signInAnonymously(state.auth); state.user = credential.user; hideConnection();
  } catch (error) {
    state.mode = "local";
    const message = String(error.message || error);
    const lowerMessage = message.toLowerCase();
    els.warning.textContent = lowerMessage.includes("api-key-not-valid") || lowerMessage.includes("api key not valid")
      ? "Tryb lokalny: klucz Firebase Web API jest nieprawidłowy. Skopiuj aktualną konfigurację aplikacji Web z Firebase Console."
      : lowerMessage.includes("configuration-not-found")
        ? "Tryb lokalny: włącz logowanie anonimowe w Firebase Console: Authentication > Sign-in method > Anonymous."
        : `Tryb lokalny: ${message}`;
    els.warning.classList.remove("hidden");
    hideConnection();
  }
}
function wireEvents() {
  els.create.addEventListener("click", () => createRoom().catch(handleFirebaseError)); els.joinBtn.addEventListener("click", () => joinRoom().catch(handleFirebaseError)); els.save.addEventListener("click", saveProfile); els.start.addEventListener("click", () => startGame().catch(handleFirebaseError));
  els.copy.addEventListener("click", () => navigator.clipboard?.writeText(state.roomId).then(() => toast("Kod skopiowany."))); els.next.addEventListener("click", nextRound);
  els.end.addEventListener("click", () => updateRoom({ status: "finished", winner: "Host zakończył grę." })); els.newGame.addEventListener("click", newGame); els.roleOk.addEventListener("click", () => els.roleModal.classList.add("hidden"));
  els.jester.addEventListener("change", () => updateOptions("jester")); els.executioner.addEventListener("change", () => updateOptions("executioner")); els.jesterChance.addEventListener("change", updateOptions); els.executionerChance.addEventListener("change", updateOptions);
  els.code.addEventListener("input", () => { els.code.value = els.code.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
}
function profile() { const name = els.name.value.trim(); if (!name) { toast("Najpierw wpisz nick."); return null; } localStorage.setItem("impostor_name", name); return { id: state.user?.uid || getLocalUid(), name, eliminated: false }; }
function getLocalUid() { let uid = localStorage.getItem("impostor_uid"); if (!uid) { uid = crypto.randomUUID(); localStorage.setItem("impostor_uid", uid); } return uid; }
function saveProfile() { profile(); toast("Profil zapisany."); }
function roomKey(id) { return `${LOCAL_PREFIX}${id}`; }
function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function currentPlayer() { return state.room?.players?.find((player) => player.id === (state.user?.uid || getLocalUid())); }
function isHost() { return state.room?.hostId === (state.user?.uid || getLocalUid()); }
function activePlayers() { return (state.room?.players || []).filter((player) => !player.eliminated); }
function maxExtraRoles(playerCount) { if (playerCount < 4) return 0; return playerCount === 4 ? 1 : 2; }
function chanceValue(input) { return Math.max(0, Math.min(100, Number(input.value) || 0)); }
function rolesSelectedByChance(options, playerCount) { return [{ name: "jester", enabled: options.jester, chance: options.jesterChance ?? 100 }, { name: "executioner", enabled: options.executioner, chance: options.executionerChance ?? 100 }].filter((role) => role.enabled && Math.random() * 100 < role.chance).map((role) => role.name).slice(0, maxExtraRoles(playerCount)); }
async function updateOptions(changedRole) {
  if (!state.room || !isHost()) return;
  const maxRoles = maxExtraRoles(state.room.players?.length || 0);
  if (maxRoles === 0) { els.jester.checked = false; els.executioner.checked = false; }
  if (maxRoles === 1 && els.jester.checked && els.executioner.checked) {
    if (changedRole === "jester") els.executioner.checked = false;
    else els.jester.checked = false;
  }
  await updateRoom({ options: { jester: els.jester.checked, executioner: els.executioner.checked, jesterChance: chanceValue(els.jesterChance), executionerChance: chanceValue(els.executionerChance) } });
}
async function createRoom() { const player = profile(); if (!player) return; state.roomId = randomCode(); await writeRoom({ status: "lobby", hostId: player.id, players: [player], round: 1, associations: {}, associationHistory: {}, votes: {}, guessVotes: {}, guess: null, winner: null, options: { jester: false, executioner: false } }); subscribeRoom(state.roomId); toast(`Utworzono pokój ${state.roomId}.`); }
async function joinRoom() { const player = profile(); if (!player) return; const roomId = els.code.value.trim().toUpperCase(); if (!roomId) return toast("Podaj kod pokoju."); const room = await readRoom(roomId); if (!room) return toast("Taki pokój nie istnieje."); if (room.status !== "lobby") return toast("Gra już trwa."); state.roomId = roomId; await writeRoom({ ...room, players: [...(room.players || []).filter((item) => item.id !== player.id), player] }); subscribeRoom(roomId); toast(`Dołączono do ${roomId}.`); }
async function startGame() {
  if (!state.room || !isHost()) return; const players = state.room.players || []; if (players.length < 3 || players.length > 10) return toast("Do gry potrzeba od 3 do 10 graczy.");
  const word = await randomWord(); const turnOrder = [...players].sort(() => Math.random() - 0.5).map((player) => player.id); const roles = [...players].sort(() => Math.random() - 0.5).map((player, index) => ({ id: player.id, role: index === 0 ? "impostor" : "player" })); let index = 1;
  const extraRoles = rolesSelectedByChance(state.room.options || {}, players.length);
  extraRoles.forEach((role) => { if (index < roles.length) roles[index++].role = role; });
  const executioner = roles.find((item) => item.role === "executioner"); const target = executioner && roles.find((item) => item.role === "player"); const byId = Object.fromEntries(roles.map((item) => [item.id, { ...item, targetId: item.id === executioner?.id ? target?.id : null }]));
  await updateRoom({ status: "playing", players: players.map((player) => ({ ...player, ...byId[player.id], eliminated: false, association: "" })), word, round: 1, turnOrder, currentTurnId: turnOrder[0], associations: {}, associationHistory: {}, votes: {}, guessVotes: {}, guess: null, winner: null });
}
async function randomWord() { try { const response = await fetch("words.txt"); const words = (await response.text()).split(/\r?\n/).map((word) => word.trim()).filter(Boolean); return words[Math.floor(Math.random() * words.length)] || "latarnia"; } catch { return "latarnia"; } }
function subscribeRoom(roomId) {
  if (state.unsub) state.unsub();
  if (state.mode === "local") { const listener = () => readRoom(roomId).then((room) => { state.room = room; render(); }); window.addEventListener("storage", listener); state.unsub = () => window.removeEventListener("storage", listener); listener(); return; }
  state.unsub = onSnapshot(doc(state.db, "rooms", roomId), (snapshot) => { state.room = snapshot.exists() ? snapshot.data() : null; render(); });
}
async function readRoom(roomId) { if (state.mode === "local") return JSON.parse(localStorage.getItem(roomKey(roomId)) || "null"); const snapshot = await getDoc(doc(state.db, "rooms", roomId)); return snapshot.exists() ? snapshot.data() : null; }
async function writeRoom(room) { if (state.mode === "local") localStorage.setItem(roomKey(state.roomId), JSON.stringify(room)); else await setDoc(doc(state.db, "rooms", state.roomId), { ...room, updatedAt: serverTimestamp() }); }
async function updateRoom(changes) { await writeRoom({ ...state.room, ...changes }); }
function render() {
  const room = state.room; els.join.classList.toggle("hidden", Boolean(room)); els.lobby.classList.toggle("hidden", !room || room.status !== "lobby"); els.game.classList.toggle("hidden", !room || room.status === "lobby"); if (!room) return;
  els.roomBadge.textContent = state.roomId || ""; els.players.innerHTML = (room.players || []).map((player) => `<div class="player-row"><strong>${escapeHtml(player.name)}</strong><span class="tag ${player.role || "pending"}">${roleLabel(player.role)}</span></div>`).join(""); const maxRoles = maxExtraRoles(room.players?.length || 0); els.lobbyInfo.textContent = `${room.players?.length || 0} graczy. Host może uruchomić grę od 3 osób. Dodatkowe role: ${maxRoles === 0 ? "od 4 graczy" : maxRoles === 1 ? "maksymalnie 1" : "maksymalnie 2"}.`; els.start.classList.toggle("hidden", !isHost()); els.jester.checked = maxRoles > 0 && Boolean(room.options?.jester); els.executioner.checked = maxRoles > 0 && Boolean(room.options?.executioner); els.jesterChance.value = room.options?.jesterChance ?? 100; els.executionerChance.value = room.options?.executionerChance ?? 100; els.jester.disabled = !isHost() || maxRoles === 0; els.executioner.disabled = !isHost() || maxRoles === 0; els.jesterChance.disabled = !isHost() || maxRoles === 0; els.executionerChance.disabled = !isHost() || maxRoles === 0;
  if (room.status === "lobby") return; const me = currentPlayer(); const active = activePlayers(); const submitted = Object.keys(room.associations || {}).length; const turnPlayer = room.players?.find((player) => player.id === room.currentTurnId); els.round.textContent = room.round || 1; els.key.textContent = me ? roleDisplay(me, room) : "-"; els.secretWord.textContent = me?.role === "impostor" ? "Ukryte" : room.word || "-"; els.secretWord.classList.toggle("secret-hidden", me?.role === "impostor"); els.badge.textContent = room.status === "finished" ? "Koniec" : "Runda aktywna";
  els.status.textContent = room.winner || room.lastVoteResult || (room.awaitingVote ? "Skojarzenia gotowe. Czas na głosowanie." : `Tura gracza: ${escapeHtml(turnPlayer?.name || "-")}.`); els.winner.classList.toggle("hidden", !room.winner); els.winner.textContent = room.winner || ""; els.next.classList.add("hidden"); els.newGame.classList.toggle("hidden", !isHost() || room.status !== "finished"); els.end.classList.toggle("hidden", !isHost() || room.status === "finished"); els.table.innerHTML = (room.turnOrder || room.players?.map((player) => player.id) || []).map((playerId) => room.players.find((player) => player.id === playerId)).filter(Boolean).map((player) => playerCard(player, me, room)).join(""); bindDynamicControls();
  if (me?.role && !sessionStorage.getItem(`role_${state.roomId}_${me.id}`)) showRole(me, room);
}
function playerCard(player, me, room) {
  const association = room.associations?.[player.id] || ""; const history = room.associationHistory?.[player.id] || []; const canAssociate = me?.id === player.id && me.id === room.currentTurnId && !association && !room.winner && !room.awaitingVote; const canVote = room.awaitingVote && !me?.eliminated && !room.votes?.[me.id] && !player.eliminated;
  const statusLabel = player.eliminated ? "Wyeliminowany" : association ? "Skojarzenie" : "Czeka"; const tileLabel = room.status === "finished" || player.eliminated ? `${statusLabel} · ${roleDisplay(player, room)}` : statusLabel;
  return `<article class="player-panel${player.eliminated ? " eliminated" : ""}" data-player-id="${player.id}"><div class="player-panel-head"><h3>${escapeHtml(player.name)}</h3><span class="badge">${escapeHtml(tileLabel)}</span></div><p class="player-report">${history.length ? escapeHtml(history.join("; ")) : "Jeszcze nic nie podał"}</p>${canAssociate ? '<div class="input-with-action"><input class="association-input" placeholder="Nowe skojarzenie" maxlength="80"><button class="btn primary association-btn">Podaj</button></div>' : ""}${canVote ? `<button class="btn vote-button" data-vote="${player.id}">Głosuj na ${escapeHtml(player.name)}</button>` : ""}</article>`;
}
function bindDynamicControls() { document.querySelectorAll(".association-btn").forEach((button) => button.addEventListener("click", submitAssociation)); document.querySelectorAll("[data-vote]").forEach((button) => button.addEventListener("click", () => castVote(button.dataset.vote))); if (currentPlayer()?.role === "impostor" && !state.room.guess && !state.room.winner) { const panel = document.createElement("div"); panel.className = "settings-box"; panel.innerHTML = '<input id="guessInput" placeholder="Odpowiedź oszusta"><button id="guessBtn" class="btn danger">Zgaduję hasło</button>'; els.table.prepend(panel); el("guessBtn").addEventListener("click", submitGuess); } const voter = currentPlayer(); const alreadyVoted = voter && Object.prototype.hasOwnProperty.call(state.room.guessVotes || {}, voter.id); if (state.room.awaitingGuessVote && voter?.role !== "impostor" && !voter?.eliminated && !alreadyVoted) { const panel = document.createElement("div"); panel.className = "settings-box"; panel.innerHTML = `<strong>Impostor podał odpowiedź: ${escapeHtml(state.room.guess)}</strong><button id="guessYes" class="btn primary">Poprawne</button><button id="guessNo" class="btn">Błędne</button>`; els.table.prepend(panel); el("guessYes").addEventListener("click", () => castGuessVote(true)); el("guessNo").addEventListener("click", () => castGuessVote(false)); } }
async function submitAssociation() { const input = document.querySelector(".association-input"); const value = input?.value.trim(); const player = currentPlayer(); if (!value) return toast("Wpisz skojarzenie."); if (!player || player.eliminated || state.room.currentTurnId !== player.id) return toast("Teraz jest tura innego gracza."); const playerId = player.id; const history = [...(state.room.associationHistory?.[playerId] || []), value]; const associations = { ...(state.room.associations || {}), [playerId]: value }; const active = activePlayers(); const order = state.room.turnOrder || active.map((item) => item.id); const currentIndex = order.indexOf(playerId); const candidates = order.filter((id, index) => index > currentIndex && active.some((item) => item.id === id) && !associations[id]); const nextPlayerId = candidates[0] || order.find((id) => active.some((item) => item.id === id) && !associations[id]); const allSubmitted = active.every((item) => associations[item.id]); await updateRoom({ associations, associationHistory: { ...(state.room.associationHistory || {}), [playerId]: history }, currentTurnId: allSubmitted ? null : nextPlayerId, awaitingVote: allSubmitted }); }
async function submitGuess() { const value = el("guessInput")?.value.trim(); if (value) await updateRoom({ guess: value, guessVotes: {}, awaitingGuessVote: true }); }
async function castGuessVote(agree) { const voter = currentPlayer(); if (!voter || voter.eliminated) return toast("Wyeliminowany gracz nie może głosować."); if (voter.role === "impostor") return toast("Impostor nie może głosować nad swoją odpowiedzią."); const votes = { ...(state.room.guessVotes || {}), [voter.id]: agree }; const eligibleVoters = activePlayers().filter((player) => player.role !== "impostor"); const updates = { guessVotes: votes }; if (Object.keys(votes).length >= eligibleVoters.length) { const yesVotes = Object.values(votes).filter(Boolean).length; const accepted = yesVotes >= eligibleVoters.length / 2; updates.status = "finished"; updates.winner = accepted ? "Gracze uznali odpowiedź za poprawną. Impostor wygrywa." : "Gracze uznali odpowiedź za błędną. Gracze wygrywają."; updates.guess = null; updates.guessVotes = {}; updates.awaitingGuessVote = false; } await updateRoom(updates); }
async function castVote(targetId) { const voter = currentPlayer(); if (!voter || voter.eliminated) return toast("Wyeliminowany gracz nie może głosować."); const votes = { ...(state.room.votes || {}), [voter.id]: targetId }; const active = activePlayers(); if (Object.keys(votes).length < active.length) return updateRoom({ votes }); const counts = Object.values(votes).reduce((all, id) => ({ ...all, [id]: (all[id] || 0) + 1 }), {}); const topVotes = Math.max(...Object.values(counts)); const leaders = Object.entries(counts).filter(([, count]) => count === topVotes); const isTie = leaders.length > 1; const eliminatedId = isTie ? null : leaders[0]?.[0]; const eliminated = state.room.players.find((player) => player.id === eliminatedId); let winner = null; if (eliminated?.role === "impostor") winner = "Zwykli gracze wykryli Impostora."; if (eliminated?.role === "jester") winner = "Jester wygrywa, bo został wygłosowany."; if (active.find((player) => player.role === "executioner")?.targetId === eliminatedId) winner = "Executioner wygrywa, bo jego cel został wygłosowany."; const players = eliminatedId ? state.room.players.map((player) => player.id === eliminatedId ? { ...player, eliminated: true } : player) : state.room.players; const remainingPlayers = players.filter((player) => !player.eliminated); if (!winner && !isTie && remainingPlayers.length === 2 && remainingPlayers.some((player) => player.role === "impostor")) winner = "Pozostało dwóch graczy. Impostor wygrywa."; const order = state.room.turnOrder || remainingPlayers.map((player) => player.id); const currentTurnId = winner ? null : order.find((id) => remainingPlayers.some((player) => player.id === id)); await updateRoom({ players, currentTurnId, round: (state.room.round || 1) + 1, associations: {}, votes: {}, awaitingVote: false, awaitingNextRound: false, lastVoteResult: isTie ? "Remis. Nikt nie został wyeliminowany. Podajcie nowe skojarzenia." : null, winner }); }
async function nextRound() { await updateRoom({ round: (state.room.round || 1) + 1, associations: {}, votes: {}, awaitingVote: false, awaitingNextRound: false, lastVoteResult: null }); }
async function newGame() {
  if (!state.room || !isHost() || state.room.status !== "finished") return;
  const players = (state.room.players || []).map((player) => ({ id: player.id, name: player.name, eliminated: false }));
  players.forEach((player) => sessionStorage.removeItem(`role_${state.roomId}_${player.id}`));
  await updateRoom({ status: "lobby", players, word: null, round: 1, associations: {}, associationHistory: {}, votes: {}, guessVotes: {}, guess: null, awaitingVote: false, awaitingGuessVote: false, awaitingNextRound: false, lastVoteResult: null, winner: null });
  toast("Nowa gra gotowa. Można dołączać do lobby.");
}
function showRole(player, room) {
  sessionStorage.setItem(`role_${state.roomId}_${player.id}`, "1");
  const isImpostor = player.role === "impostor";
  const roleText = roleDisplay(player, room);
  els.roleTitle.textContent = roleText;
  els.roleRole.textContent = roleText;
  els.roleWord.textContent = isImpostor ? "Ukryte dla Impostora" : room.word;
  els.roleWord.classList.toggle("secret-hidden", isImpostor);
  els.roleText.textContent = isImpostor
    ? "Nie znasz tajnego hasła. Słuchaj innych, podaj wiarygodne skojarzenia i spróbuj odgadnąć hasło w dowolnym momencie."
    : `Tajne hasło: ${room.word}`;
  els.roleVisual.textContent = "";
  els.roleModal.classList.remove("hidden");
}
function roleDisplay(player, room) { return player.role === "executioner" ? `Executioner (${room.players.find((item) => item.id === player.targetId)?.name || "brak celu"})` : roleLabel(player.role); }
function roleLabel(role) { return ({ impostor: "Impostor", jester: "Jester", executioner: "Executioner", player: "Crewmate" }[role] || "oczekuje"); }
function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function toast(message) { els.toast.textContent = message; els.toast.classList.remove("hidden"); setTimeout(() => els.toast.classList.add("hidden"), 2600); }
function showConnection(message) { els.connection.textContent = message; els.connection.classList.remove("hidden"); }
function hideConnection() { els.connection.classList.add("hidden"); }
function handleFirebaseError(error) { const code = error?.code || ""; toast(code === "permission-denied" ? "Brak dostępu do Firestore. Opublikuj reguły firestore.rules w Firebase Console." : `Błąd Firebase: ${error?.message || error}`); }
