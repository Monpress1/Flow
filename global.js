// global.js - Include this on ALL pages
const SB_URL = 'https://ueuhuyzuacvwqpfszrzy.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldWh1eXp1YWN2d3FwZnN6cnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjQzOTksImV4cCI6MjA5MDQwMDM5OX0.DCAPnXLo7sM576-KC4HzXT09uc6nn9u00gT1RYCIxUs';
const flowClient = window.supabase.createClient(SB_URL, SB_KEY);

let globalUser = null;
let globalChannel = null;
let challengeTimeout = null;

// 1. Auto-Inject the Popup HTML into the page
document.addEventListener("DOMContentLoaded", async () => {
    const popupHTML = `
    <div id="global-challenge-popup" class="fixed top-5 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[10000] transition-transform duration-500 transform -translate-y-[150%]">
        <div class="bg-slate-900/95 backdrop-blur-xl p-4 rounded-2xl border border-blue-500/50 shadow-2xl shadow-blue-900/20">
            <div class="flex items-center gap-4">
                <img id="popup-challenger-img" src="" class="w-12 h-12 rounded-full border-2 border-blue-500 object-cover bg-slate-800">
                <div class="flex-1">
                    <p class="text-xs font-bold text-white"><span id="popup-challenger-name" class="text-blue-400">Player</span> challenged you!</p>
                    <div class="w-full bg-slate-800 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div id="popup-timer-bar" class="bg-blue-500 h-full w-full" style="transition: width 10s linear;"></div>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 mt-4">
                <button onclick="respondToChallenge(false)" class="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold active:scale-95 transition">Decline</button>
                <button onclick="respondToChallenge(true)" class="flex-1 py-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 text-xs font-bold active:scale-95 transition">Accept</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', popupHTML);

    const { data: { session } } = await flowClient.auth.getSession();
    if (session) {
        globalUser = session.user;
        initGlobalPresence();
    }
});

function initGlobalPresence() {
    // Get page name from title (e.g., "Flow | Account" -> "Account")
    const pageName = document.title.split('|')[1]?.trim() || "App"; 
    
    globalChannel = flowClient.channel('global_lobby', {
        config: { presence: { key: globalUser.id } }
    });

    globalChannel
        .on('broadcast', { event: 'incoming_challenge' }, ({ payload }) => {
            if (payload.targetId === globalUser.id) showChallengePopup(payload);
        })
        .on('broadcast', { event: 'challenge_response' }, ({ payload }) => {
            // If you invited someone and they replied
            if (payload.challengerId === globalUser.id) handleChallengeResponse(payload);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const meta = globalUser.user_metadata;
                await globalChannel.track({
                    id: globalUser.id,
                    username: meta.username || 'Player',
                    avatar: meta.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${globalUser.id}`,
                    location: pageName,
                    status: 'online'
                });
            }
        });
}

let currentChallengeData = null;

function showChallengePopup(payload) {
    currentChallengeData = payload;
    const popup = document.getElementById('global-challenge-popup');
    document.getElementById('popup-challenger-name').innerText = payload.challengerName;
    document.getElementById('popup-challenger-img').src = payload.challengerAvatar;
    
    // Reset and animate timer
    const timerBar = document.getElementById('popup-timer-bar');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    
    popup.classList.remove('-translate-y-[150%]');
    
    // Start animation
    setTimeout(() => {
        timerBar.style.transition = 'width 10s linear';
        timerBar.style.width = '0%';
    }, 50);

    // Auto decline after 10s
    challengeTimeout = setTimeout(() => {
        respondToChallenge(false);
    }, 10000);
}

async function respondToChallenge(accepted) {
    clearTimeout(challengeTimeout);
    document.getElementById('global-challenge-popup').classList.add('-translate-y-[150%]');
    
    if (!currentChallengeData) return;

    await globalChannel.send({
        type: 'broadcast',
        event: 'challenge_response',
        payload: {
            challengerId: currentChallengeData.challengerId,
            targetId: globalUser.id,
            accepted: accepted,
            matchId: currentChallengeData.matchId
        }
    });

    if (accepted) {
        window.location.href = `wager.html?match=${currentChallengeData.matchId}&opp=${currentChallengeData.challengerId}&role=guest`;
    }
    currentChallengeData = null;
}

function handleChallengeResponse(payload) {
    if (payload.accepted) {
        window.location.href = `wager.html?match=${payload.matchId}&opp=${payload.targetId}&role=host`;
    } else {
        // Dispatch event so lobby.html knows they declined
        window.dispatchEvent(new CustomEvent('challengeDeclined', { detail: payload.targetId }));
    }
}
