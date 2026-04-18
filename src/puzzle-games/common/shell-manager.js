/**
 * Shell Manager - Handles communication between the Shell UI and the Game Iframe
 */

const shellStatus = document.getElementById('shell-status');
const shellLogList = document.getElementById('shell-log-list');
const shellPlayerList = document.getElementById('shell-player-list');

window.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'SET_STATUS':
            if (shellStatus) {
                if (data.html) shellStatus.innerHTML = data.text;
                else shellStatus.textContent = data.text;
            }
            break;

        case 'LOG_MESSAGE':
            if (shellLogList) {
                const color = data.color || 'var(--neon-blue)';
                shellLogList.innerHTML = `<li><span style="color:${color}">${data.prefix || 'SYSTEM'}:</span> ${data.message}</li>`;
            }
            break;

        case 'UPDATE_PLAYERS':
            if (shellPlayerList) {
                shellPlayerList.innerHTML = data.players.map(p => `
                    <div class="player-entry">
                        <span class="player-name">${p.name}</span>
                    </div>
                `).join('');
            }
            break;

        case 'RELOAD_SHELL':
            window.location.reload();
            break;
    }
});
