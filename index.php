<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AquaTime</title>
    
    <meta name="theme-color" content="#60A5FA">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 15Q30 40 30 60a20 20 0 0 0 40 0Q70 40 50 15z' fill='%2360A5FA'/><path d='M45 20Q30 40 30 60a15 15 0 0 0 30 0Q60 40 45 20z' fill='%23F9A8D4' opacity='0.8'/></svg>">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        /* Animação suave para o progresso */
        .progress-ring__circle { transition: stroke-dashoffset 0.5s ease-in-out; }
        
.swipe-container {
        position: relative;
        overflow: hidden; /* Garante que nada saia da caixa */
        touch-action: pan-y; /* Permite scroll vertical, mas gerenciamos o horizontal */
    }

    .swipe-action-bg {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: 100%; /* Ocupa tudo, mas fica atrás */
        background-color: #EF4444; /* Vermelho Tailwind (red-500) */
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 24px;
        z-index: 0;
        border-radius: 0.75rem; /* rounded-xl */
    }

    .swipe-content {
        position: relative;
        z-index: 10;
        background-color: white; /* Ou a cor do seu tema */
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        /* Importante para o arrasto não selecionar texto */
        user-select: none; 
    }
    </style>
</head>
<body class="bg-gray-50 text-gray-800 selection:bg-blue-100 selection:text-blue-900">

    <div class="max-w-md mx-auto min-h-screen flex flex-col px-6 pt-1 pb-6 relative">
        
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900 tracking-tight" id="userNameDisplay">
                    <span class="animate-pulse bg-gray-200 text-transparent rounded">Carregando...</span>
                </h1>
                <p class="text-sm font-medium text-gray-500 mt-0.5" id="currentDateDisplay">Hoje</p>
            </div>
            
            <div class="flex items-center space-x-3">
                <button onclick="showNotifModal()" class="relative p-2.5 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 hover:shadow-md transition-all active:scale-95">
                    <i class="fas fa-bell text-lg"></i>
                    <span id="notifBadge" class="hidden absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <button onclick="logout()" class="p-2.5 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-red-500 hover:shadow-md transition-all active:scale-95">
                    <i class="fas fa-sign-out-alt text-lg"></i>
                </button>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-2 mb-8 flex justify-between items-center border border-gray-100">
            <button onclick="changeDate(-1)" class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-500 transition-colors">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="relative group">
                <input type="date" id="datePicker" class="text-gray-700 font-semibold bg-transparent border-none focus:ring-0 text-center cursor-pointer font-inter">
            </div>
            <button onclick="changeDate(1)" class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-500 transition-colors">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>

        <div class="relative w-64 h-64 mx-auto mb-10 group cursor-pointer" onclick="showChartModal()">
            <div class="absolute inset-0 rounded-full bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] transform group-hover:scale-105 transition-transform duration-300"></div>
            <svg class="transform -rotate-90 w-full h-full relative z-10" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#F3F4F6" stroke-width="8" stroke-linecap="round" />
                <circle id="progressCircle" cx="60" cy="60" r="54" fill="none" stroke="#3B82F6" stroke-width="8" 
                        stroke-dasharray="339.292" stroke-dashoffset="339.292" stroke-linecap="round" 
                        class="progress-ring__circle drop-shadow-lg" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center z-20">
                <span id="percentageText" class="text-5xl font-black text-gray-800 tracking-tighter">0%</span>
                <span id="remainingText" class="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">Faltam 2500ml</span>
            </div>
            <div class="absolute bottom-0 right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-400 border border-gray-50 group-hover:text-blue-500 transition-colors">
                <i class="fas fa-chart-line text-sm"></i>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6">
            <button onclick="addWater(200)" class="group relative flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 active:scale-95">
                <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <i class="fas fa-glass-water text-lg"></i>
                </div>
                <span class="font-bold text-gray-700 text-sm">200ml</span>
            </button>
            <button onclick="addWater(250)" class="group relative flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 active:scale-95">
                <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <i class="fas fa-mug-hot text-lg"></i>
                </div>
                <span class="font-bold text-gray-700 text-sm">250ml</span>
            </button>
            <button onclick="addWater(500)" class="group relative flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 active:scale-95">
                <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <i class="fas fa-bottle-water text-lg"></i>
                </div>
                <span class="font-bold text-gray-700 text-sm">500ml</span>
            </button>
        </div>

        <div class="flex space-x-3 mb-8">
            <div class="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex items-center">
                <input type="number" id="manualInput" placeholder="Outro valor..." class="w-full px-4 py-2 text-gray-700 font-medium bg-transparent border-none focus:ring-0 outline-none" inputmode="numeric">
                <button onclick="addManualWater()" class="bg-gray-900 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors shadow-md">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
        
<div onclick="requestQualityDetails()" class="mb-8 bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all active:scale-95 group">
            <div class="flex items-center gap-4">
                <div id="qualityIconBg" class="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl transition-colors duration-300">
                    <i id="qualityIcon" class="fa-solid fa-chart-staggered"></i>
                </div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Qualidade da Hidratação</span>
                    <span id="dashboardQualityMsg" class="text-sm font-bold text-gray-700 leading-tight">Toque para analisar</span>
                </div>
            </div>
            
            <div class="text-right flex items-baseline">
                <span id="dashboardQualityScore" class="text-3xl font-black text-gray-800 tracking-tight">--</span>
                <span class="text-sm font-bold text-gray-400 ml-0.5">%</span>
            </div>
        </div>
        
        <div class="mt-6 mb-8">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hoje</h3>
            <div id="todayList" class="space-y-2">
                <p class="text-gray-300 text-xs italic">A carregar...</p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div class="flex items-center space-x-2 text-orange-500 mb-2">
                    <i class="fas fa-fire"></i>
                    <span class="text-xs font-bold uppercase tracking-wider">Ofensiva</span>
                </div>
                <p class="text-2xl font-black text-gray-800" id="streakDisplay">0 <span class="text-sm font-medium text-gray-400">dias</span></p>
            </div>
            
            <button onclick="showThemeModal()" class="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg text-white flex flex-col justify-between items-start hover:shadow-xl transition-all active:scale-95">
                <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm mb-2">
                    <i class="fas fa-palette text-sm"></i>
                </div>
                <span class="font-bold text-sm">Personalizar</span>
            </button>
        </div>

        <div class="mb-2">
            <div class="flex justify-between items-end mb-4 px-1">
                <h2 class="text-lg font-bold text-gray-800">Meus Amigos</h2>
                <button onclick="showAddFriendModal()" class="text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                    + Adicionar
                </button>
            </div>
            
            <div id="friendsList" class="space-y-3">
                <div class="flex justify-center py-6">
                    <i class="fas fa-spinner fa-spin text-gray-300 text-2xl"></i>
                </div>
            </div>
        </div>
    </div>
    
    <div class="mb-6 text-center">
    <button onclick="showBugModal()" class="text-xs text-gray-400 hover:text-gray-600 underline decoration-dotted transition-colors">
        Reportar Bug ou Sugestão
    </button>
    </div>

    <div id="themeModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity opacity-0" onclick="hideThemeModal()"></div>
        <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-end justify-center sm:items-center p-0 sm:p-4">
                <div class="relative transform overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full sm:max-w-md translate-y-full sm:translate-y-10 opacity-0 sm:scale-95 duration-300 ease-out h-[70vh] sm:h-auto flex flex-col">
                    
                    <div class="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center sticky top-0 z-20">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 leading-6">Cores</h3>
                            <p class="text-xs text-gray-500 mt-1">Escolha seu estilo</p>
                        </div>
                        <button onclick="hideThemeModal()" class="w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
                        <div id="colorPalette" class="grid grid-cols-4 gap-4">
                            </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="chartModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="chart-modal-backdrop fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ease-out opacity-0" onclick="hideChartModal()"></div>
        <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                <div class="chart-modal-content relative transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all duration-300 ease-out sm:my-8 w-full md:max-w-md translate-y-10 opacity-0 scale-95 max-h-[90vh] flex flex-col">
                    <div class="p-6 pb-8 overflow-y-auto custom-scrollbar"> 
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h3 class="font-bold text-xl text-gray-800">Seu Desempenho</h3>
                                <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Últimos 7 dias</p>
                            </div>
                            <button onclick="hideChartModal()" class="w-10 h-10 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-all focus:outline-none flex-shrink-0">
                                <i class="fas fa-times text-lg"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div class="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                                <div class="flex items-center space-x-2 mb-1">
                                    <div class="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center">
                                        <i class="fas fa-chart-bar text-xs text-blue-600"></i>
                                    </div>
                                    <span class="text-xs font-semibold text-blue-400 uppercase">Média</span>
                                </div>
                                <p class="text-2xl font-black text-gray-800" id="chartAvg">0<span class="text-sm font-medium text-gray-500 ml-1">ml</span></p>
                            </div>

                            <div class="bg-green-50 rounded-2xl p-4 border border-green-100">
                                <div class="flex items-center space-x-2 mb-1">
                                    <div class="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center">
                                        <i class="fas fa-trophy text-xs text-green-600"></i>
                                    </div>
                                    <span class="text-xs font-semibold text-green-400 uppercase">Melhor Dia</span>
                                </div>
                                <p class="text-xl font-black text-gray-800" id="chartBestDay">--</p>
                            </div>
                        </div>

                        <div class="relative h-64 w-full mb-4">
                            <canvas id="consumptionChart"></canvas>
                        </div>

                        <div class="mt-4 pb-2 relative z-10">
                            <button onclick="hideChartModal()" class="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 hover:bg-gray-800">
                                Continuar focado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="addFriendModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity opacity-0" onclick="hideAddFriendModal()"></div>
        <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                <div class="transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-sm translate-y-10 opacity-0 scale-95 duration-300 ease-out">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="font-bold text-lg text-gray-800">Adicionar Amigo</h3>
                            <button onclick="hideAddFriendModal()" class="text-gray-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><i class="fas fa-times"></i></button>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Número do Celular</label>
                                <input type="tel" id="searchPhone" placeholder="(00) 00000-0000" inputmode="numeric" 
                                       class="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all font-medium text-lg">
                            </div>
                            
                            <button onclick="searchFriend()" class="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                                Buscar
                            </button>

                            <div id="searchResult" class="hidden mt-4 p-4 bg-gray-50 rounded-xl text-center border border-gray-100">
                                </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="notifModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity opacity-0" onclick="hideNotifModal()"></div>
        <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                <div class="transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-sm translate-y-10 opacity-0 scale-95 duration-300 ease-out">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="font-bold text-lg text-gray-800">Solicitações</h3>
                            <button onclick="hideNotifModal()" class="text-gray-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><i class="fas fa-times"></i></button>
                        </div>
                        <div id="notifList" class="space-y-3 min-h-[100px]">
                            </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div id="editTimeModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity opacity-0" onclick="hideEditTimeModal()"></div>
    <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
            <div class="transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all w-full max-w-xs translate-y-10 opacity-0 scale-95 duration-300 ease-out">
                <div class="p-6">
                    <h3 class="font-bold text-lg text-gray-800 mb-4 text-center">Alterar Horário</h3>
                    
                    <div class="space-y-4">
                        <input type="tel" id="timeInput" placeholder="00:00" maxlength="5" inputmode="numeric" 
                               class="w-full px-4 py-4 bg-gray-50 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all font-mono text-3xl text-center tracking-widest text-gray-700">
                        
                        <input type="hidden" id="editRecordId">

                        <button onclick="saveNewTime()" class="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 active:scale-95 transition-all">
                            Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div id="bugModal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity opacity-0" onclick="hideBugModal()"></div>
    <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
            <div class="transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all w-full max-w-sm translate-y-10 opacity-0 scale-95 duration-300 ease-out">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-lg text-gray-800">Ajude a melhorar</h3>
                        <button onclick="hideBugModal()" class="text-gray-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><i class="fas fa-times"></i></button>
                    </div>
                    
                    <form id="bugForm" class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">O que aconteceu?</label>
                            <textarea id="bugMessage" rows="3" required placeholder="Ex: O botão de água não funcionou..." 
                                    class="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 resize-none text-sm"></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Print (Opcional)</label>
                            <input type="file" id="bugImage" accept="image/*"
                                   class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
                        </div>

                        <button type="submit" class="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 active:scale-95 transition-all">
                            Enviar Report
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Animação de desenhar o círculo */
    .checkmark-circle {
        stroke-dasharray: 166;
        stroke-dashoffset: 166;
        stroke-width: 2;
        stroke-miterlimit: 10;
        stroke: #10B981; /* Verde Emerald */
        fill: none;
        /* A animação roda quando a classe 'animate-stroke' é adicionada via JS */
    }

    /* Animação de desenhar o V (check) */
    .checkmark-check {
        transform-origin: 50% 50%;
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
    }

    /* Classes auxiliares para rodar a animação */
    .run-animation .checkmark-circle {
        animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }
    .run-animation .checkmark-check {
        animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
    }

    @keyframes stroke {
        100% { stroke-dashoffset: 0; }
    }
</style>

<div id="successModal" class="fixed inset-0 z-[120] flex items-center justify-center hidden pointer-events-none">
    <div class="absolute inset-0 bg-white/10 backdrop-blur-sm transition-opacity opacity-0 duration-300"></div>
    
    <div class="relative bg-white/95 shadow-2xl rounded-3xl p-6 transform scale-95 opacity-0 transition-all duration-300 flex flex-col items-center min-w-[160px]">
        <div class="w-16 h-16 mb-2">
            <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke-width="3" stroke="#10B981" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <h3 id="successText" class="text-gray-800 font-bold text-lg">Registrado!</h3>
    </div>
</div>

<div id="distributionModal" class="fixed inset-0 z-[150] flex items-end sm:items-center justify-center hidden pointer-events-none">
    
    <div id="distModalBg" onclick="closeDistModal()" class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity opacity-0 pointer-events-auto"></div>
    
    <div id="distModalContent" class="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 transform translate-y-full sm:translate-y-10 opacity-0 transition-all duration-500 ease-out pointer-events-auto pb-8 sm:pb-6">
        
        <div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>

        <div class="flex items-center justify-between mb-6">
            <div>
                <h3 class="text-xl font-bold text-gray-800">Qualidade do Dia</h3>
                <p id="distMessage" class="text-sm text-gray-500 mt-1 font-medium">Analisando hidratação...</p>
            </div>
            
            <div class="relative flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 border-4 border-white shadow-lg shadow-blue-100">
                <span id="distScoreVal" class="text-xl font-bold text-blue-600">0</span>
                <span class="text-[10px] absolute top-3 right-2 text-blue-400">%</span>
            </div>
        </div>

        <div class="relative w-full mb-6">
            <div class="w-full h-10 rounded-xl overflow-hidden shadow-inner border border-gray-200 bg-gray-100 relative">
                <canvas id="timelineCanvas" width="1020" height="1" class="w-full h-full block"></canvas>
            </div>
            
            <div class="flex justify-between text-[10px] font-bold text-gray-400 mt-2 px-1 uppercase tracking-wider">
                <span>07h</span>
                <span>15h</span>
                <span>00h</span>
            </div>
        </div>

        <div class="flex items-center gap-5 text-xs text-gray-500 mb-8 justify-center font-medium">
            <div class="flex items-center gap-1.5"><div id="distLegendDot" class="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>Hidratado</div>
            <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-gray-300 rounded-full"></div> Sem cobertura</div>
        </div>

        <button onclick="closeDistModal()" class="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 hover:bg-gray-800">
            Continuar
        </button>
    </div>
</div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="script.js?v=<?php echo filemtime('script.js'); ?>"></script>
</body>
</html>