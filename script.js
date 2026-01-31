/**
 * AQUATIME - script.js
 * Gerencia a lógica de frontend, autenticação e interface.
 */

// ==========================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// ==========================================
let currentUserId = null;
let currentDailyGoal = 2500;
let currentDayHistory = [];
let myConsumptionChart = null; // Instância do Chart.js
let currentThemeColors = { primary: '#3B82F6', primaryDark: '#1D4ED8' }; // Cor padrão (Azul)

// Configuração do círculo de progresso
const circle = document.getElementById('progressCircle');
const radius = circle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;

// Inicializa o dasharray do círculo
circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = circumference;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Configura a data de hoje no input
    const todayLocal = new Date();
    const year = todayLocal.getFullYear();
    const month = String(todayLocal.getMonth() + 1).padStart(2, '0');
    const day = String(todayLocal.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const datePicker = document.getElementById('datePicker');
    
    // CORREÇÃO iOS: Forçamos o valor de hoje, ignorando o que o navegador salvou
    datePicker.value = today; 

    renderColorPalette();
    await loadUserData();
    await loadFriends();
    setupEventListeners();
    
    // Atualização automática a cada 15s
    setInterval(async () => {
        if (datePicker.value === today) {
            await loadFriends();
        }
    }, 15000);
});

function setupEventListeners() {
    // Atualiza dados ao mudar a data
    document.getElementById('datePicker').addEventListener('change', () => {
        loadUserData();
        loadFriends(); // Histórico de amigos também muda com a data
    });

    // Máscara para o campo de busca de telefone (Modal Adicionar Amigo)
    const searchInput = document.getElementById('searchPhone');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    // Enter no input manual de água
    const manualInput = document.getElementById('manualInput');
    if (manualInput) {
        manualInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') addManualWater();
        });
    }
}

// ==========================================
// LÓGICA DE DADOS (API)
// ==========================================

async function loadUserData(showFeedback = false) {
    try {
        const date = document.getElementById('datePicker').value;
        updateDateDisplay(date);

        // --- NOVO: Verifica se a data selecionada é HOJE ---
        // Isso impede que a nota seja baixa só porque o dia ainda não acabou
        const todayObj = new Date();
        // Formata data local YYYY-MM-DD
        const year = todayObj.getFullYear();
        const month = String(todayObj.getMonth() + 1).padStart(2, '0');
        const day = String(todayObj.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        const isToday = (date === todayStr); 
        // ---------------------------------------------------

        // Chama a API
        const response = await fetch(`api.php?action=get_user_data&date=${date}`);
        const data = await response.json();

        // Verificação de Segurança
        if (response.status === 401 || data.redirect) {
            window.location.href = 'login.html';
            return;
        }

        // Atualiza Globais
        currentUserId = data.id;
        currentDailyGoal = parseInt(data.goal) || 2500;
        
        // 1. SALVAR OS DADOS NA MEMÓRIA
        currentDayHistory = data.history || [];

        // Atualiza Interface
        const firstName = data.name.split(' ')[0];
        document.getElementById('userNameDisplay').textContent = `Olá, ${firstName}`;

        const badge = document.getElementById('notifBadge');
        if (data.notifications > 0) {
            badge.classList.remove('hidden');
            badge.textContent = ""; 
        } else {
            badge.classList.add('hidden');
        }

        if (data.theme_index !== undefined && data.theme_index !== null) {
            applyThemeUI(data.theme_index);
        }

        updateDashboard(data.totalConsumed, currentDailyGoal);
       
        // 5. Renderiza Lista de Histórico e Calcula Qualidade
        if (data.history) {
            // A. Ordenação: Mais recente (22:00) no topo
            data.history.sort((a, b) => b.time.localeCompare(a.time));

            renderHistoryList(data.history);

            // B. Calcula a Qualidade
            const qualityData = calculateSmartDistribution(data.history, currentDailyGoal, isToday);
            
// ============================================================
// ATUALIZA O WIDGET DA TELA INICIAL (TEXTO + ÍCONE + "HIDRATADO ATÉ")
// ============================================================
const dashScore = document.getElementById('dashboardQualityScore');
const dashMsg = document.getElementById('dashboardQualityMsg');
const iconBg = document.getElementById('qualityIconBg');
const iconEl = document.getElementById('qualityIcon');

if (dashScore && dashMsg) {
    dashScore.innerText = qualityData.score;

    // Mensagem principal + linha extra com "Hidratado até" (se existir)
    dashMsg.innerHTML = qualityData.message + 
        (qualityData.hydratedUntil ? 
            `<br><span class="text-xs text-gray-400">Hidratado até ≈ ${qualityData.hydratedUntil}</span>` : 
            '');

    // Reset do ícone
    if (iconBg) {
        iconBg.className = "w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors duration-300";
        iconEl.className = "";
    }

    // Cores e ícones conforme a nota
    if (qualityData.score >= 80) {
        dashScore.className = "text-3xl font-black text-green-500 tracking-tight";
        if (iconBg) {
            iconBg.classList.add("bg-green-100", "text-green-600");
            iconEl.className = "fa-solid fa-trophy";
        }
    } else if (qualityData.score >= 50) {
        dashScore.className = "text-3xl font-black text-yellow-500 tracking-tight";
        if (iconBg) {
            iconBg.classList.add("bg-yellow-100", "text-yellow-600");
            iconEl.className = "fa-solid fa-chart-simple";
        }
    } else {
        dashScore.className = "text-3xl font-black text-red-500 tracking-tight";
        if (iconBg) {
            iconBg.classList.add("bg-red-100", "text-red-500");
            iconEl.className = "fa-solid fa-circle-exclamation";
        }
    }
}
            // ============================================================

            // C. Se foi solicitado feedback (adicionou água agora), abre o modal grande
           /* if (showFeedback) {
                setTimeout(() => {
                    openDistModal(qualityData);
                }, 1200);
            }
            */
            
        } else {
            // Se não tiver histórico (dia vazio), zera o widget da home também
            const dashScore = document.getElementById('dashboardQualityScore');
            const dashMsg = document.getElementById('dashboardQualityMsg');
            if (dashScore && dashMsg) {
                dashScore.innerText = "0";
                dashMsg.innerText = "Comece a beber água";
                dashScore.className = "text-3xl font-black text-gray-300 tracking-tight";
            }
        }

        if (data.streak !== undefined) {
             document.getElementById('streakDisplay').innerHTML = `${data.streak} <span class="text-sm font-medium text-gray-400">dias</span>`;
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

function renderHistoryList(history) {
    const container = document.getElementById('todayList');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = '<p class="text-gray-300 text-xs italic">Nenhum registo hoje.</p>';
        return;
    }

    // Estrutura corrigida: Container Relativo > Fundo Absoluto > Conteúdo Relativo
    container.innerHTML = history.map(item => `
        <div class="swipe-container relative mb-3 rounded-xl shadow-sm bg-white" id="history-item-${item.id}">
            
            <div class="swipe-action-bg absolute inset-0 w-full h-full bg-red-500 rounded-xl flex items-center justify-end pr-6 cursor-pointer z-0" 
                 onclick="deleteWater(${item.id})">
                <i class="fas fa-trash-alt text-white text-lg"></i>
            </div>

            <div class="swipe-content relative z-10 bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center w-full"
                 onmousedown="handleSwipeStart(event)" 
                 onmousemove="handleSwipeMove(event)" 
                 onmouseup="handleSwipeEnd(event)"
                 onmouseleave="handleSwipeEnd(event)"
                 ontouchstart="handleSwipeStart(event)" 
                 ontouchmove="handleSwipeMove(event)" 
                 ontouchend="handleSwipeEnd(event)">
                
                <div class="flex items-center space-x-3 pointer-events-none">
                    <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xs">
                        <i class="fas fa-glass-water"></i>
                    </div>
                    <span class="font-bold text-gray-700">${item.amount_ml}ml</span>
                </div>
                
                <button onclick="editTime(${item.id}, '${item.time}'); event.stopPropagation();" class="group flex items-center space-x-1 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors z-20">
                    <span class="font-mono tracking-wide">${item.time.substring(0, 5)}</span>
                    <i class="fas fa-pen text-[10px] opacity-50 group-hover:opacity-100 transition-opacity"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// LÓGICA DE SWIPE (HÍBRIDA: MOBILE + PC)
// ==========================================

let startX = 0;
let startY = 0;
let currentSwipedElement = null;
let isDragging = false; // Necessário para diferenciar "passar o mouse" de "arrastar"

// Função auxiliar para pegar a posição X (seja mouse ou touch)
function getEventX(e) {
    return e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
}

// Função auxiliar para pegar a posição Y
function getEventY(e) {
    return e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
}

function handleSwipeStart(e) {
    // Se for mouse, só ativa com botão esquerdo (button 0)
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    const content = e.currentTarget;
    
    startX = getEventX(e);
    startY = getEventY(e);
    
    // Remove transição para resposta instantânea
    content.style.transition = 'none';
    
    // Fecha outros itens abertos
    if (currentSwipedElement && currentSwipedElement !== content) {
        closeSwipe(currentSwipedElement);
    }
}

function handleSwipeMove(e) {
    if (!isDragging) return;

    const content = e.currentTarget;
    const currentX = getEventX(e);
    const currentY = getEventY(e);
    
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    // Detecta se é scroll vertical (apenas para touch)
    if (e.type === 'touchmove' && Math.abs(diffY) > Math.abs(diffX)) return;

    // Lógica de arrastar para esquerda
    if (diffX < 0) {
        // Evita selecionar texto ou arrastar imagem no PC
        if(e.cancelable && e.type !== 'touchmove') e.preventDefault(); 
        
        // No mobile, evita scroll da tela
        if (e.type === 'touchmove' && e.cancelable) e.preventDefault();

        // Limite visual (-100px)
        const move = Math.max(diffX, -100);
        content.style.transform = `translateX(${move}px)`;
    }
}

function handleSwipeEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const content = e.currentTarget;
    const endX = getEventX(e);
    const diffX = endX - startX;
    
    // Restaura animação suave
    content.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

    // Se arrastou mais de 60px para esquerda, trava aberto
    if (diffX < -60) {
        content.style.transform = 'translateX(-70px)';
        currentSwipedElement = content;
    } else {
        closeSwipe(content);
    }
}

function closeSwipe(element) {
    if (!element) return;
    element.style.transform = 'translateX(0)';
    if (currentSwipedElement === element) {
        currentSwipedElement = null;
    }
}

// Função para deletar um registro específico
async function deleteWater(id) {
    // 1. Tenta pegar o elemento visual e o texto da quantidade (ex: "250ml")
    const itemElement = document.getElementById(`history-item-${id}`);
    let amountText = "Registro"; // Valor padrão caso não ache
    
    if (itemElement) {
        // Busca o span que tem o valor (geralmente onde tem a classe font-bold)
        const spanText = itemElement.querySelector('span.font-bold');
        if (spanText) amountText = spanText.innerText;
    }

    // 2. Confirmação
    if(!confirm(`Excluir ${amountText}?`)) {
        // Se cancelar, fecha o swipe visualmente
        if(itemElement) {
            const content = itemElement.querySelector('.swipe-content');
            if (typeof closeSwipe === 'function') {
                closeSwipe(content);
            }
        }
        return;
    }

    try {
        const response = await fetch('api.php?action=delete_water', {
            method: 'POST',
            body: JSON.stringify({ id: id })
        });

        const result = await response.json();

        if (result.status === 'success' || response.ok) {
            
            // 3. Remove o item da lista visualmente
            if (itemElement) {
                itemElement.style.transition = 'all 0.3s ease';
                itemElement.style.opacity = '0';
                itemElement.style.height = '0';
                itemElement.style.marginBottom = '0';
            }

            // 4. Chama SUA função existente com a mensagem personalizada
            showSuccessFeedback(`${amountText} removido!`);
            
            // 5. Atualiza os dados gerais (círculo, totais, etc)
            setTimeout(async () => {
                await loadUserData();
            }, 300);

        } else {
            alert('Erro ao excluir: ' + (result.message || 'Tente novamente.'));
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function editTime(id, oldTime) {
    // Pega apenas a hora e minuto (HH:MM)
    const currentHM = oldTime.substring(0, 5);
    
    // Abre um prompt nativo do navegador (simples e funcional para mobile)
    const newTime = prompt("Alterar horário para:", currentHM);

    // Se o usuário cancelou ou não digitou nada, para aqui
    if (!newTime) return;

    // Validação básica de formato HH:MM
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime)) {
        alert("Formato inválido. Use HH:MM (ex: 14:30)");
        return;
    }

    try {
        await fetch('api.php?action=update_water_time', {
            method: 'POST',
            body: JSON.stringify({ id: id, time: newTime })
        });
        
        // Recarrega a lista para mostrar o novo horário
        loadUserData();
        
    } catch (error) {
        console.error('Erro ao editar horário', error);
        alert('Erro ao salvar.');
    }
}

function updateDateDisplay(dateString) {
    const dateParts = dateString.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);

    const display = document.getElementById('currentDateDisplay');
    
    if (dateObj.getTime() === today.getTime()) {
        display.textContent = "Hoje";
        display.classList.add('text-blue-600', 'font-bold');
        display.classList.remove('text-gray-500');
    } else {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        display.textContent = dateObj.toLocaleDateString('pt-BR', options);
        display.classList.remove('text-blue-600', 'font-bold');
        display.classList.add('text-gray-500');
    }
}

function updateDashboard(total, goal) {
    const percentage = Math.min(100, Math.round((total / goal) * 100));
    const remaining = Math.max(0, goal - total);

    // Atualiza Textos
    document.getElementById('percentageText').textContent = `${percentage}%`;
    
    const remainingText = document.getElementById('remainingText');
    if (remaining > 0) {
        remainingText.textContent = `Faltam ${remaining}ml`;
        remainingText.classList.remove('text-green-500');
        remainingText.classList.add('text-gray-400');
    } else {
        remainingText.textContent = "Meta Batida!";
        remainingText.classList.remove('text-gray-400');
        remainingText.classList.add('text-green-500', 'font-bold');
    }

    // Atualiza Círculo (Stroke Offset)
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    // Atualiza cor do círculo baseado no tema atual
    circle.style.stroke = currentThemeColors.primary;
}

// ==========================================
// AÇÕES DE ÁGUA
// ==========================================

async function addWater(amount) {
    const date = document.getElementById('datePicker').value;
    
    // Feedback visual no botão (seu código original)
    // Adicionei uma verificação de segurança caso 'event' não esteja definido
    if (typeof event !== 'undefined' && event.currentTarget) {
        const btn = event.currentTarget;
        btn.classList.add('scale-90');
        setTimeout(() => btn.classList.remove('scale-90'), 150);
    }

    try {
        // Guardamos a resposta da API numa variável
        const response = await fetch('api.php?action=add_water', {
            method: 'POST',
            body: JSON.stringify({ amount: amount, date: date })
        });

        // Só mostramos o sucesso se o servidor responder OK (Status 200)
        if (response.ok) {
            // 1. Recarrega os dados
            await loadUserData();
            loadFriends();
            
            // 2. CHAMA O MODAL ANIMADO AQUI
            // (Certifique-se de que colou a função showSuccessFeedback no final do arquivo)
            showSuccessFeedback("Registrado!");
        }

    } catch (error) {
        console.error('Erro ao adicionar água', error);
        alert('Erro ao salvar. Verifique sua conexão.');
    }
}

function addManualWater() {
    const input = document.getElementById('manualInput');
    const amount = parseInt(input.value);
    
    if (amount > 0) {
        addWater(amount);
        input.value = ''; // Limpa input
    } else {
        alert('Digite um valor válido');
    }
}

function changeDate(days) {
    const picker = document.getElementById('datePicker');
    const current = new Date(picker.value + "T00:00:00"); // Fix fuso horário
    current.setDate(current.getDate() + days);
    picker.value = current.toISOString().split('T')[0];
    
    // Dispara evento de change para recarregar dados
    picker.dispatchEvent(new Event('change'));
}

async function logout() {
    await fetch('api.php?action=logout');
    window.location.href = 'login.html';
}

// ==========================================
// SISTEMA DE AMIGOS (ATUALIZADO)
// ==========================================

async function loadFriends() {
    const list = document.getElementById('friendsList');
    const date = document.getElementById('datePicker').value;
    
    try {
        const res = await fetch(`api.php?action=get_friends_dashboard&date=${date}`);
        const friends = await res.json();

        if (!Array.isArray(friends) || friends.length === 0) {
            list.innerHTML = `
                <div class="text-center p-6 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div class="text-gray-300 mb-2"><i class="fas fa-user-friends text-2xl"></i></div>
                    <p class="text-gray-500 text-sm font-medium">Convide amigos para competir!</p>
                </div>`;
            return;
        }

// Localize este bloco dentro da função loadFriends()
list.innerHTML = friends.map(f => {
    const percentage = Math.min(100, Math.round((f.total / f.goal) * 100));
    const friendThemeIndex = f.theme_index !== null ? f.theme_index : 0;
    const theme = predefinedThemes[friendThemeIndex] || predefinedThemes[0];
    const friendColor = theme.primary;
    const avatarStyle = `background-color: ${friendColor}15; color: ${friendColor}; border-color: ${friendColor}40;`;
    const barStyle = `background-color: ${friendColor}`;

    return `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:shadow-md animate-fade-in">
        <div class="flex items-center space-x-3 w-full">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2" style="${avatarStyle}">
                ${f.name.charAt(0)}
            </div>
            
            <div class="flex-1">
                <div class="flex justify-between mb-1">
                    <div class="flex items-center space-x-2">
                        <span class="font-bold text-gray-800 text-sm">${f.name}</span>
                        ${f.streak > 0 ? `<span class="text-xs font-bold text-orange-500"><i class="fas fa-fire"></i> ${f.streak}</span>` : ''}
                    </div>
                    <span class="text-xs font-medium text-gray-500">${f.total}/${f.goal}ml</span>
                </div>
                
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div class="h-2 rounded-full transition-all duration-1000 ease-out" style="width: ${percentage}%; ${barStyle}"></div>
                </div>
            </div>
        </div>

        <button onclick="removeFriend(${f.id}, '${f.name}', event)" class="ml-4 text-gray-300 hover:text-red-500 transition-colors p-2">
                <i class="fas fa-trash-can"></i>
            </button>
    </div>`;
}).join('');

    } catch (e) {
        console.error("Erro ao carregar amigos", e);
        list.innerHTML = `<p class="text-red-400 text-xs text-center">Erro ao carregar lista.</p>`;
    }
}

// Buscando Amigo
async function searchFriend() {
    const phone = document.getElementById('searchPhone').value;
    const resultDiv = document.getElementById('searchResult');
    
    if (phone.length < 14) { // Tamanho mínimo (41) ...
        alert("Digite o número completo.");
        return;
    }

    resultDiv.innerHTML = '<div class="text-blue-500"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';
    resultDiv.classList.remove('hidden');

    try {
        const res = await fetch(`api.php?action=search_friend&phone=${phone}`);
        const data = await res.json();

        if (data.found) {
            let contentHtml = '';
            
            if (data.status === 'can_add') {
                contentHtml = `
                    <p class="font-bold text-gray-800 text-lg mb-2">${data.name}</p>
                    <button onclick="sendInvite(${data.id})" class="w-full py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-sm">
                        Enviar Convite
                    </button>
                `;
            } else if (data.status === 'pending') {
                contentHtml = `
                    <p class="font-bold text-gray-800">${data.name}</p>
                    <p class="text-sm text-orange-500 mt-1 font-medium bg-orange-50 py-1 px-3 rounded-full inline-block">Convite já enviado</p>
                `;
            } else if (data.status === 'already_friends') {
                contentHtml = `
                    <p class="font-bold text-gray-800">${data.name}</p>
                    <p class="text-sm text-blue-500 mt-1 font-medium bg-blue-50 py-1 px-3 rounded-full inline-block">Já são amigos!</p>
                `;
            }

            resultDiv.innerHTML = contentHtml;
        } else {
            resultDiv.innerHTML = `<p class="text-gray-500 text-sm">Usuário não encontrado.<br>Verifique o número.</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p class="text-red-500 text-sm">Erro na busca.</p>`;
    }
}

async function sendInvite(id) {
    const resultDiv = document.getElementById('searchResult');
    resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    await fetch('api.php?action=send_invite', {
        method: 'POST',
        body: JSON.stringify({ target_id: id })
    });
    
    resultDiv.innerHTML = `
        <div class="text-green-600 flex flex-col items-center">
            <i class="fas fa-check-circle text-3xl mb-2"></i>
            <span class="font-bold">Convite Enviado!</span>
        </div>
    `;
    
    // Limpa após 2 segundos
    setTimeout(() => {
        hideAddFriendModal();
    }, 2000);
}

async function respondInvite(id, action) {
    await fetch('api.php?action=respond_invite', {
        method: 'POST',
        body: JSON.stringify({ invite_id: id, response: action })
    });
    // Atualiza UI
    showNotifModal(); // Recarrega lista
    loadUserData(); // Atualiza badge
    if(action === 'accept') loadFriends(); // Atualiza dashboard
}

// ==========================================
// MODAIS (Animação estilo iOS)
// ==========================================

// Função Genérica para Abrir Modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');
    
    // Pequeno delay para permitir renderização antes da transição CSS
    setTimeout(() => {
        // Backdrop
        const backdrop = modal.querySelector('div[onclick]');
        if(backdrop) backdrop.classList.remove('opacity-0');

        // Conteúdo
        const content = modal.querySelector('.transform');
        if(content) {
            content.classList.remove('translate-y-10', 'translate-y-full', 'opacity-0', 'scale-95');
            content.classList.add('translate-y-0', 'opacity-100', 'scale-100');
        }
    }, 10);
}

// Função Genérica para Fechar Modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Backdrop
    const backdrop = modal.querySelector('div[onclick]');
    if(backdrop) backdrop.classList.add('opacity-0');

    // Conteúdo
    const content = modal.querySelector('.transform');
    if(content) {
        content.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
        // Verifica se é mobile para animação correta (slide down vs fade)
        if(modalId === 'themeModal' && window.innerWidth < 640) {
             content.classList.add('translate-y-full', 'opacity-0');
        } else {
             content.classList.add('translate-y-10', 'opacity-0', 'scale-95');
        }
    }

    // Espera a transição terminar para esconder
    setTimeout(() => {
        modal.classList.add('hidden');
        
        // Limpezas específicas
        if (modalId === 'addFriendModal') {
            document.getElementById('searchResult').classList.add('hidden');
            document.getElementById('searchResult').innerHTML = '';
            document.getElementById('searchPhone').value = '';
        }
    }, 300);
}

// Wrappers Específicos (para os onclicks do HTML)
function showAddFriendModal() { openModal('addFriendModal'); }
function hideAddFriendModal() { closeModal('addFriendModal'); }

function showThemeModal() { openModal('themeModal'); }
function hideThemeModal() { closeModal('themeModal'); }

async function showNotifModal() {
    const list = document.getElementById('notifList');
    list.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-gray-400"></i></div>';
    
    openModal('notifModal');

    // Busca dados atualizados
    try {
        const res = await fetch('api.php?action=get_notifications');
        const data = await res.json();

        if (data.invites.length > 0) {
            list.innerHTML = data.invites.map(inv => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            ${inv.name.charAt(0)}
                        </div>
                        <span class="font-bold text-gray-700 text-sm">${inv.name}</span>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="respondInvite(${inv.id}, 'accept')" class="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors">
                            <i class="fas fa-check text-xs"></i>
                        </button>
                        <button onclick="respondInvite(${inv.id}, 'reject')" class="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = `
                <div class="text-center py-6">
                    <div class="text-gray-300 mb-2"><i class="far fa-bell-slash text-2xl"></i></div>
                    <p class="text-gray-400 text-sm">Nenhuma solicitação nova.</p>
                </div>`;
        }
    } catch (e) {
        list.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar.</p>';
    }
}
function hideNotifModal() { closeModal('notifModal'); }


// ==========================================
// GRÁFICO (Chart.js)
// ==========================================

async function showChartModal() {
    openModal('chartModal');
    
    const labels = [];
    const dataPoints = [];
    const todayLocal = new Date();

    // 1. Busca dados dos últimos 7 dias
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayLocal);
        d.setDate(todayLocal.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        labels.push(dayName);
        
        try {
            const res = await fetch(`api.php?action=get_user_data&date=${dateStr}`);
            const json = await res.json();
            dataPoints.push(json.totalConsumed || 0);
        } catch (e) {
            dataPoints.push(0);
        }
    }
    
    renderChart(labels, dataPoints);

    // 2. CÁLCULO DA MÉDIA (Exclui hoje)
    const pastDaysData = dataPoints.slice(0, -1); 
    const totalPast = pastDaysData.reduce((a, b) => a + b, 0);
    const divisor = pastDaysData.length > 0 ? pastDaysData.length : 1;
    const avg = Math.round(totalPast / divisor);

    // 3. BUSCA RECORDE
    let bestTotal = 0;
    let bestDate = "--/--";

    try {
        const resBest = await fetch('api.php?action=get_best_day');
        const dataBest = await resBest.json();
        if (dataBest.status === 'success' && dataBest.total > 0) {
            bestTotal = dataBest.total;
            const dateParts = dataBest.date.split('-');
            bestDate = `${dateParts[2]}/${dateParts[1]}`;
        }
    } catch (e) { console.error(e); }

    // ==========================================
    // RENDERIZAÇÃO PIXEL-PERFECT (Ajuste de Alinhamento)
    // ==========================================
    
    // Configuração comum para ambas as caixas
    // Usamos 'leading-none' para remover espaços fantasmas de linha
    
    // Caixa da Média
    document.getElementById('chartAvg').innerHTML = `
        <div class="flex flex-col items-start leading-none">
            <div class="flex items-baseline h-7">
                <span class="text-2xl font-black text-gray-800 leading-none">${avg}</span>
                <span class="text-sm font-bold text-gray-400 ml-1 leading-none">ml</span>
            </div>
            <div class="h-3 mt-2 flex items-center">
                <span class="text-[10px] font-bold text-blue-500/40 uppercase tracking-wider leading-none">Últimos 6 dias</span>
            </div>
        </div>
    `;

    // Caixa do Melhor Dia
    document.getElementById('chartBestDay').innerHTML = `
        <div class="flex flex-col items-start leading-none">
            <div class="flex items-baseline h-7">
                <span class="text-2xl font-black text-gray-800 leading-none">${bestTotal}</span>
                <span class="text-sm font-bold text-gray-400 ml-1 leading-none">ml</span>
            </div>
            <div class="h-3 mt-2 flex items-center">
                <span class="text-[10px] font-bold text-green-500/40 uppercase tracking-wider leading-none">Recorde em ${bestDate}</span>
            </div>
        </div>
    `;
}

function hideChartModal() { closeModal('chartModal'); }

function renderChart(labels, data) {
    const ctx = document.getElementById('consumptionChart').getContext('2d');
    
    if (myConsumptionChart) {
        myConsumptionChart.destroy();
    }

    // Gradiente bonito
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, currentThemeColors.primary); // Usa cor do tema
    gradient.addColorStop(1, '#ffffff00');

    myConsumptionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo (ml)',
                data: data,
                borderColor: currentThemeColors.primary,
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: currentThemeColors.primary,
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Curvas suaves (estilo iOS)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1F2937',
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${context.raw} ml`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [5, 5], color: '#f3f4f6' },
                    ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' }
                }
            }
        }
    });
}

// ==========================================
// TEMAS E CORES
// ==========================================

const predefinedThemes = [
    { name: 'Azul Padrão', primary: '#3B82F6', primaryDark: '#1D4ED8' },
    { name: 'Vermelho Intenso', primary: '#DC2626', primaryDark: '#991B1B' },
    { name: 'Rosa Choque', primary: '#EC4899', primaryDark: '#BE185D' },
    { name: 'Roxo Real', primary: '#8B5CF6', primaryDark: '#6D28D9' },
    { name: 'Verde Esmeralda', primary: '#10B981', primaryDark: '#047857' },
    { name: 'Laranja Solar', primary: '#F59E0B', primaryDark: '#B45309' },
    { name: 'Ciano Oceano', primary: '#06B6D4', primaryDark: '#0E7490' },
    { name: 'Indigo Profundo', primary: '#6366F1', primaryDark: '#4338CA' },
    { name: 'Lima Vibrante', primary: '#84CC16', primaryDark: '#4D7C0F' },
    { name: 'Cinza Grafite', primary: '#4B5563', primaryDark: '#1F2937' },
    { name: 'Amarelo Ouro', primary: '#EAB308', primaryDark: '#A16207' },
    { name: 'Teal', primary: '#14B8A6', primaryDark: '#0F766E' },
    { name: 'Sky', primary: '#0EA5E9', primaryDark: '#0369A1' },
    { name: 'Fuchsia', primary: '#D946EF', primaryDark: '#A21CAF' },
    { name: 'Rose', primary: '#F43F5E', primaryDark: '#BE123C' },
    { name: 'Menta Fresca', primary: '#34D399', primaryDark: '#059669' }, // Verde Água suave
    { name: 'Azul Meia-Noite', primary: '#1E3A8A', primaryDark: '#172554' }, // Azul muito escuro/sério
    { name: 'Uva Real', primary: '#9333EA', primaryDark: '#6B21A8' }, // Roxo mais vibrante que o atual
    { name: 'Chocolate', primary: '#78350F', primaryDark: '#451A03' }, // Marrom elegante
    { name: 'Vinho', primary: '#BE123C', primaryDark: '#881337' },
    { name: 'Preto Onyx', primary: '#27272A', primaryDark: '#000000' }, // Estilo "Dark Mode" puro/Minimalista
    { name: 'Verde Floresta', primary: '#166534', primaryDark: '#14532D' }, // Verde bem fechado e natural
    { name: 'Azul Petróleo', primary: '#155E75', primaryDark: '#083344' }, // Um azul esverdeado profundo e elegante
    { name: 'Terracota', primary: '#C2410C', primaryDark: '#7C2D12' } // Laranja queimado/terroso
];

function renderColorPalette() {
    const container = document.getElementById('colorPalette');
    if (!container) return;

    container.innerHTML = predefinedThemes.map((theme, index) => `
        <button onclick="saveTheme(${index})" class="group relative w-12 h-12 rounded-full shadow-sm hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300" style="background-color: ${theme.primary}">
            <div id="check-${index}" class="hidden absolute inset-0 flex items-center justify-center text-white">
                <i class="fas fa-check text-sm drop-shadow-md"></i>
            </div>
        </button>
    `).join('');
}

async function saveTheme(index) {
    // 1. Aplica visualmente na hora
    applyThemeUI(index);
    hideThemeModal();

    // 2. Salva no banco
    try {
        await fetch('api.php?action=set_theme', {
            method: 'POST',
            body: JSON.stringify({ theme_index: index })
        });
    } catch (e) {
        console.error('Erro ao salvar tema', e);
    }
}

function applyThemeUI(index) {
    if (index < 0 || index >= predefinedThemes.length) return;
    
    const theme = predefinedThemes[index];
    currentThemeColors = theme;

    // Atualiza Globais de cor
    document.documentElement.style.setProperty('--primary-color', theme.primary);
    
    // Atualiza Círculo
    const circle = document.getElementById('progressCircle');
    if (circle) circle.style.stroke = theme.primary;
    
    // Atualiza Meta Tags para mobile (barra de status)
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme.primary);

    // Atualiza ícones de check no modal
    predefinedThemes.forEach((_, i) => {
        const check = document.getElementById(`check-${i}`);
        if(check) {
            if (i === index) check.classList.remove('hidden');
            else check.classList.add('hidden');
        }
    });
}

// ==========================================
// MÁSCARA DE HORÁRIO (Digitar sem :)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const timeInput = document.getElementById('timeInput');
    
    if (timeInput) {
        timeInput.addEventListener('input', function(e) {
            // 1. Remove tudo que não é número
            let value = e.target.value.replace(/\D/g, '');
            
            // 2. Limita a 4 números (ex: 1913)
            if (value.length > 4) value = value.slice(0, 4);

            // 3. Adiciona os dois pontos automaticamente após o segundo número
            if (value.length > 2) {
                value = value.slice(0, 2) + ':' + value.slice(2);
            }

            e.target.value = value;
        });
    }
});

// ==========================================
// LÓGICA DE EDIÇÃO DE HORÁRIO
// ==========================================

// 1. Abrir o Modal
function editTime(id, oldTime) {
    const modal = document.getElementById('editTimeModal');
    const input = document.getElementById('timeInput');
    const idField = document.getElementById('editRecordId');

    // Preenche os campos ocultos e visíveis
    idField.value = id;
    input.value = oldTime.substring(0, 5); // Pega HH:MM

    // Mostra o Modal (Animação iOS)
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-900\\/60').classList.remove('opacity-0');
        const content = modal.querySelector('.transform');
        content.classList.remove('translate-y-10', 'opacity-0', 'scale-95');
        content.classList.add('translate-y-0', 'opacity-100', 'scale-100');
        
        // Foca no input para digitar logo
        input.focus();
    }, 10);
}

// 2. Fechar o Modal
function hideEditTimeModal() {
    const modal = document.getElementById('editTimeModal');
    const content = modal.querySelector('.transform');
    
    content.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
    content.classList.add('translate-y-10', 'opacity-0', 'scale-95');
    modal.querySelector('.bg-gray-900\\/60').classList.add('opacity-0');
    
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// 3. Salvar (Chama a API)
// 3. Salvar (Chama a API)
async function saveNewTime() {
    const id = document.getElementById('editRecordId').value;
    const time = document.getElementById('timeInput').value;
    const btn = document.querySelector('#editTimeModal button');

    // Validação de formato (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(time)) {
        alert("Horário inválido. Use horas reais (00:00 a 23:59)");
        return;
    }

    // Feedback visual no botão
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...';
    btn.disabled = true; // Impede cliques múltiplos

    try {
        // Guardamos a resposta para verificar se foi OK
        const response = await fetch('api.php?action=update_water_time', {
            method: 'POST',
            body: JSON.stringify({ id: id, time: time })
        });
        
        if (response.ok) {
            // 1. Fecha o modal de edição para limpar a tela
            hideEditTimeModal();
            
            // 2. Atualiza a lista de registros
            await loadUserData(); 
            
            // 3. EXIBE O CHECK VERDE ANIMADO
            showSuccessFeedback("Horário Atualizado!");
        } else {
            alert('Erro ao salvar a alteração.');
        }
        
    } catch (error) {
        console.error('Erro ao editar horário', error);
        alert('Erro de conexão.');
    } finally {
        // Restaura o botão (caso o modal não feche por erro ou para próxima vez)
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// REPORTAR BUGS
// ==========================================

function showBugModal() {
    const modal = document.getElementById('bugModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.bg-gray-900\\/60').classList.remove('opacity-0');
        const content = modal.querySelector('.transform');
        content.classList.remove('translate-y-10', 'opacity-0', 'scale-95');
        content.classList.add('translate-y-0', 'opacity-100', 'scale-100');
    }, 10);
}

function hideBugModal() {
    const modal = document.getElementById('bugModal');
    const content = modal.querySelector('.transform');
    content.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
    content.classList.add('translate-y-10', 'opacity-0', 'scale-95');
    modal.querySelector('.bg-gray-900\\/60').classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// Enviar o formulário
document.getElementById('bugForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = document.getElementById('bugMessage').value;
    const image = document.getElementById('bugImage').files[0];
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;

    btn.innerText = 'Enviando...';
    btn.disabled = true;

    // Prepara os dados (Texto + Arquivo)
    const formData = new FormData();
    formData.append('message', message);
    if (image) {
        formData.append('screenshot', image);
    }

    try {
        // Envia para a API (Sem cabeçalho JSON, pois é FormData)
        await fetch('api.php?action=report_bug', {
            method: 'POST',
            body: formData
        });

        alert("Obrigado! Seu feedback foi enviado.");
        document.getElementById('bugForm').reset();
        hideBugModal();

    } catch (error) {
        alert("Erro ao enviar. Tente novamente.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// ==========================================
// FUNÇÃO DE FEEDBACK VISUAL
// ==========================================
function showSuccessFeedback(message = "Registrado!") {
    const modal = document.getElementById('successModal');
    const backdrop = modal.querySelector('.absolute');
    const card = modal.querySelector('.relative');
    const textElement = document.getElementById('successText');
    const svgContainer = modal.querySelector('svg');
    
    // Define o texto
    textElement.textContent = message;

    // Mostra o modal
    modal.classList.remove('hidden');
    
    // Força o reinício da animação CSS removendo e recolocando a classe
    svgContainer.classList.remove('run-animation');
    void svgContainer.offsetWidth; // Truque para forçar o navegador a reiniciar o render
    svgContainer.classList.add('run-animation');

    // Animação de entrada (Fade In + Scale)
    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
    });

    // Fecha automaticamente depois de 1.8 segundos
    setTimeout(() => {
        backdrop.classList.add('opacity-0');
        card.classList.remove('scale-100', 'opacity-100');
        card.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }, 1800);
}

async function removeFriend(id, name, event) {
    // 1. Confirmação
    if (!confirm(`Deseja remover ${name} da sua lista?`)) return;

    // 2. Localiza o elemento visual (o card branco)
    // O event.currentTarget garante que pegamos o botão, mesmo se clicar no ícone
    const card = event.currentTarget.closest('.bg-white');

    try {
        const response = await fetch('api.php?action=remove_friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friend_id: id })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // === INÍCIO DA ANIMAÇÃO DE DESLIZAR PARA ESQUERDA ===
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = 'translateX(-120%)'; // Move para a ESQUERDA
            card.style.opacity = '0';
            card.style.maxHeight = '0';
            card.style.margin = '0';
            card.style.padding = '0';
            card.style.pointerEvents = 'none'; // Impede cliques durante a animação

            // 3. Aguarda a animação terminar para atualizar a lista
            setTimeout(() => {
                loadFriends(); 
            }, 600);
            
        } else {
            alert('Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro de conexão ao tentar remover amigo.');
    }
}

// =============================================================
// SISTEMA DE QUALIDADE DE HIDRATAÇÃO (TIMELINE & CÁLCULO)
// =============================================================

function calculateSmartDistribution(history, currentGoal, isToday = false) {
    if (!history || history.length === 0) {
        return { 
            score: 0, 
            message: "Comece a beber água!", 
            coveredMinutes: new Set(),
            hydratedUntil: null 
        };
    }

    // Início do dia estritamente às 07:00
    const startDayMin = 7 * 60;      
    const fullEndDayMin = 24 * 60;   
    const totalDayMinutes = fullEndDayMin - startDayMin;

    const safeGoal = currentGoal > 0 ? currentGoal : 2500;
    const mlPerMinute = safeGoal / totalDayMinutes;

    const sortedHistory = [...history].sort((a, b) => a.time.localeCompare(b.time));

    let coveredMinutes = new Set();
    let latestCoveredMinute = -1; 

    sortedHistory.forEach(record => {
        const amount = parseInt(record.amount_ml || record.amount);
        if (isNaN(amount)) return;

        const parts = record.time.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        if (isNaN(hours) || isNaN(minutes)) return;

        let timeInMin = hours * 60 + minutes;

        // Agora não ignoramos mais registros antes das 7h. 
        // Apenas ignoramos se for após o fim do dia (meia-noite).
        if (timeInMin >= fullEndDayMin) return;

        let theoreticalDuration = Math.round(amount / mlPerMinute);
        let maxDuration = amount >= 500 ? 150 : 120;
        let actualDuration = Math.min(theoreticalDuration, maxDuration);

        // Preenche os minutos de cobertura
        for (let i = 0; i < actualDuration; i++) {
            let minute = timeInMin + i;
            if (minute < fullEndDayMin) {
                coveredMinutes.add(minute);
                if (minute > latestCoveredMinute) {
                    latestCoveredMinute = minute;
                }
            }
        }
    });

    let endCalculationTime = fullEndDayMin;

    if (isToday) {
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();
        
        // Se "agora" for antes das 7h, o cálculo ainda não começou efetivamente para a nota, 
        // a menos que haja projeção futura.
        let baseTime = Math.max(currentMin, startDayMin);
        
        endCalculationTime = Math.max(baseTime, latestCoveredMinute + 1);
        endCalculationTime = Math.min(endCalculationTime, fullEndDayMin);
    }

    // A duração considerada para a nota SEMPRE começa às 07:00
    const consideredDuration = endCalculationTime - startDayMin;

    let coveredInWindow = 0;
    coveredMinutes.forEach(m => {
        // SÓ CONTA PARA A NOTA SE O MINUTO FOR >= 07:00
        if (m >= startDayMin && m < endCalculationTime) {
            coveredInWindow++;
        }
    });

    // Se ainda não deu 7h e não há projeção que passe das 7h
    if (consideredDuration <= 0) {
        return { 
            score: 100, 
            message: "Aguardando início às 07:00", 
            coveredMinutes, 
            hydratedUntil: formatTime(latestCoveredMinute) 
        };
    }

    let score = Math.round((coveredInWindow / consideredDuration) * 100);
    let msg = "";
    if (score >= 90) msg = "Ritmo Perfeito! 🏆";
    else if (score >= 70) msg = "Muito bom! 👍";
    else if (score >= 50) msg = "Atenção aos intervalos 👀";
    else msg = "Beba mais regularmente 💧";

    return { 
        score, 
        message: msg, 
        coveredMinutes, 
        hydratedUntil: formatTime(latestCoveredMinute) 
    };
}

// Função auxiliar para formatar a hora
function formatTime(totalMinutes) {
    if (totalMinutes < 0) return null;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 2. O DESENHISTA (CANVAS)
 * Pinta 1080 listras verticais para criar o gráfico perfeito.
 */
function openDistModal(qualityData) {
    const modal = document.getElementById('distributionModal');
    const bg = document.getElementById('distModalBg');
    const content = document.getElementById('distModalContent');
    const scoreVal = document.getElementById('distScoreVal');
    const msg = document.getElementById('distMessage');
    const canvas = document.getElementById('timelineCanvas');

// Preenche Texto e Cores
scoreVal.innerText = qualityData.score;
msg.innerHTML = qualityData.message + 
    (qualityData.hydratedUntil ? 
        `<br><span class="text-xs text-gray-400 mt-2 block">Hidratado até ≈ ${qualityData.hydratedUntil}</span>` : 
        '');
    
    if(qualityData.score >= 80) scoreVal.className = "text-xl font-bold text-green-500";
    else if(qualityData.score >= 50) scoreVal.className = "text-xl font-bold text-yellow-500";
    else scoreVal.className = "text-xl font-bold text-red-500";

    // PINTURA DO GRÁFICO
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const startDayMin = 7 * 60;  // 420
        const endDayMin = 24 * 60;   // 1440
        const totalMinutes = endDayMin - startDayMin; // 1080 pixels de largura lógica

        // Reseta o Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Loop principal: Percorre cada um dos 1080 minutos do dia útil
        for (let i = 0; i < totalMinutes; i++) {
            const realMinuteOfTheDay = startDayMin + i;

            if (qualityData.coveredMinutes.has(realMinuteOfTheDay)) {
    // Usa a cor do tema escolhida pelo usuário (ou azul se não houver)
    ctx.fillStyle = (currentThemeColors && currentThemeColors.primary) ? currentThemeColors.primary : '#3B82F6'; 
} else {
                // Minuto Seco (Cinza Claro)
                ctx.fillStyle = '#E5E7EB'; 
            }

            // Desenha uma linha de 1 pixel de largura
            ctx.fillRect(i, 0, 1, 1);
        }
    }

    // Animação de Entrada Suave
    modal.classList.remove('hidden');
    // RequestAnimationFrame garante fluidez
    requestAnimationFrame(() => {
        bg.classList.remove('opacity-0');
        content.classList.remove('translate-y-full', 'opacity-0', 'sm:translate-y-10');
        content.classList.add('translate-y-0', 'opacity-100');
    });
    
    const legendDot = document.getElementById('distLegendDot');
if (legendDot) {
    legendDot.style.backgroundColor = currentThemeColors.primary;
}
}

/**
 * 3. FECHAR MODAL
 */
function closeDistModal() {
    const modal = document.getElementById('distributionModal');
    const bg = document.getElementById('distModalBg');
    const content = document.getElementById('distModalContent');

    bg.classList.add('opacity-0');
    content.classList.add('translate-y-full', 'opacity-0', 'sm:translate-y-10');
    content.classList.remove('translate-y-0', 'opacity-100');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 400); // Espera a animação terminar
}

/**
 * FUNÇÃO DE ATALHO PARA O WIDGET DA HOME
 * Chamada quando clica no card "Qualidade da Hidratação"
 */
function requestQualityDetails() {
    // 1. Identifica a data para saber se o cálculo é "até agora"
    const datePicker = document.getElementById('datePicker');
    const selectedDate = datePicker ? datePicker.value : "";
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    const isToday = (selectedDate === todayStr);

    // 2. Usa os dados que já estão salvos na variável global
    // Se a lista estiver vazia, passamos um array vazio para não dar erro
    const historyToUse = currentDayHistory || [];

    // 3. Calcula e abre na mesma hora
    const qualityData = calculateSmartDistribution(historyToUse, currentDailyGoal, isToday);
    openDistModal(qualityData);
}