<?php
// api.php
// Configuração de Sessão Persistente (30 dias)
ini_set('session.gc_maxlifetime', 2592000);
session_set_cookie_params([
    'lifetime' => 2592000,
    'path' => '/',
    'domain' => '', // Seu domínio ou deixe vazio para localhost/atual
    'secure' => true, // Mude para false se não tiver HTTPS rodando ainda
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();

header('Content-Type: application/json');
include 'config.php';
date_default_timezone_set('America/Sao_Paulo');

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? '';

// Função auxiliar para resposta JSON
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    // ======================================================
    // ROTAS PÚBLICAS (Login/Registro/Migração de Senha)
    // ======================================================

    // ROTA ESPECIAL: Resetar senha de Maicon/Leticia (apenas para inicialização)
    // Chame api.php?action=migrate_passwords uma vez para fixar a senha '12345678'
    if ($action === 'migrate_passwords') {
        $hash = password_hash('12345678', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id IN (1, 2)");
        $stmt->execute([$hash]);
        jsonResponse(['message' => 'Senhas de ID 1 e 2 resetadas para 12345678']);
    }

    if ($action === 'login') {
        $phone = preg_replace('/\D/', '', $input['phone'] ?? ''); // Remove formatação
        $password = $input['password'] ?? '';

        if (empty($phone) || empty($password)) {
            jsonResponse(['error' => 'Preencha todos os campos'], 400);
        }

        $stmt = $pdo->prepare("SELECT id, name, password, daily_goal_ml FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            jsonResponse(['status' => 'success', 'redirect' => 'index.php']);
        } else {
            jsonResponse(['error' => 'Telefone ou senha incorretos'], 401);
        }
    }

    if ($action === 'register') {
        $name = $input['name'];
        $phone = preg_replace('/\D/', '', $input['phone']);
        $password = $input['password'];
        $goal = $input['daily_goal'];

        // Validações
        if (strlen($phone) < 10) jsonResponse(['error' => 'Telefone inválido'], 400);
        if (strlen($password) < 8) jsonResponse(['error' => 'A senha deve ter 8 números'], 400);

        // Verifica duplicidade
        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetch()) jsonResponse(['error' => 'Telefone já cadastrado'], 400);

        // Cria usuário
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name, phone, password, daily_goal_ml, theme_index) VALUES (?, ?, ?, ?, 0)");
        
        if ($stmt->execute([$name, $phone, $hash, $goal])) {
            $_SESSION['user_id'] = $pdo->lastInsertId();
            $_SESSION['user_name'] = $name;
            jsonResponse(['status' => 'success', 'redirect' => 'index.php']);
        } else {
            jsonResponse(['error' => 'Erro ao criar conta'], 500);
        }
    }

    // ======================================================
    // ROTAS PROTEGIDAS (Requer Login)
    // ======================================================
    
    if (!isset($_SESSION['user_id'])) {
        if ($action === 'logout') { // Permite logout mesmo se sessão expirou
            session_destroy();
            jsonResponse(['redirect' => 'login.html']);
        }
        jsonResponse(['error' => 'Não autorizado', 'redirect' => 'login.html'], 401);
    }

    $my_id = $_SESSION['user_id'];

    if ($action === 'logout') {
        session_destroy();
        jsonResponse(['redirect' => 'login.html']);
    }

    // Obter dados do usuário logado + Notificações
    if ($action === 'get_user_data') {
        $date = $_GET['date'] ?? date('Y-m-d');

        // 1. Dados do Usuário
        $stmt = $pdo->prepare("SELECT name, daily_goal_ml AS goal, theme_index FROM users WHERE id = ?");
        $stmt->execute([$my_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // 2. Consumo Total de Hoje
        $stmt = $pdo->prepare("SELECT SUM(amount_ml) AS total FROM consumption WHERE user_id = ? AND date = ?");
        $stmt->execute([$my_id, $date]);
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;

        // 3. Histórico Visual (Lista de copos)
        $stmt = $pdo->prepare("SELECT id, amount_ml, time FROM consumption WHERE user_id = ? AND date = ? ORDER BY id DESC");
        $stmt->execute([$my_id, $date]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ==================================================
        // 4. CÁLCULO DA OFENSIVA (STREAK) - AJUSTADO PARA SUA TABELA
        // ==================================================
        
        // A. Busca histórico de consumo (últimos 365 dias)
        $stmt = $pdo->prepare("
            SELECT date, SUM(amount_ml) as total 
            FROM consumption 
            WHERE user_id = ? 
            GROUP BY date 
            ORDER BY date DESC 
            LIMIT 365
        ");
        $stmt->execute([$my_id]);
        $daily_logs = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // B. Busca histórico de metas (Usando suas colunas: goal_ml e date_set)
        try {
            $stmt = $pdo->prepare("SELECT goal_ml, date_set FROM goal_history WHERE user_id = ? ORDER BY date_set DESC");
            $stmt->execute([$my_id]);
            $goals_history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $goals_history = []; 
        }

        // Função para descobrir qual era a meta naquele dia
        $getGoalForDate = function($target_date_str) use ($goals_history, $user) {
            foreach ($goals_history as $record) {
                // Compara a data alvo com a date_set do histórico
                if ($record['date_set'] <= $target_date_str) {
                    return $record['goal_ml']; // Retorna a meta histórica correta
                }
            }
            // Se a data for mais antiga que o primeiro registro de histórico,
            // tenta pegar o registro mais antigo disponível ou usa a meta atual como fallback
            if (!empty($goals_history)) {
                 return end($goals_history)['goal_ml'];
            }
            return $user['goal']; 
        };

        $streak = 0;
        $check_date = new DateTime(); // Começa Hoje
        
        // --- Passo 1: Verifica HOJE ---
        $today_str = $check_date->format('Y-m-d');
        $goal_today = $getGoalForDate($today_str);
        $amount_today = $daily_logs[$today_str] ?? 0;

        // Se hoje bateu a meta, soma 1. 
        if ($amount_today >= $goal_today) {
            $streak++;
        }
        
        // Recua para Ontem para começar o loop retroativo
        $check_date->modify('-1 day'); 

        // --- Passo 2: Verifica Dias Passados ---
        while (true) {
            $date_str = $check_date->format('Y-m-d');
            $goal_that_day = $getGoalForDate($date_str); // Pega a meta correta daquele dia (ex: 2000ml em Outubro)
            $amount_that_day = $daily_logs[$date_str] ?? 0;

            if ($amount_that_day >= $goal_that_day) {
                $streak++;
                $check_date->modify('-1 day');
            } else {
                // Se falhou num dia passado, a ofensiva acaba
                break;
            }
            
            // Trava de segurança
            if ($streak > 730) break;
        }

        // 5. Notificações
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM friendships WHERE addressee_id = ? AND status = 'pending'");
        $stmt->execute([$my_id]);
        $notifications = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        echo json_encode(array_merge($user, [
            'totalConsumed' => (int)$total,
            'notifications' => (int)$notifications,
            'history' => $history,
            'streak' => $streak
        ]));
    }
    
    // Cole este bloco aqui:
    elseif ($action === 'get_best_day') {
        if (!isset($_SESSION['user_id'])) jsonResponse(['error' => 'Auth required'], 401);
        $my_id = $_SESSION['user_id'];

        // Busca o dia com a maior soma de ml na sua tabela 'consumption'
        $stmt = $pdo->prepare("
            SELECT date, SUM(amount_ml) as total 
            FROM consumption 
            WHERE user_id = ? 
            GROUP BY date 
            ORDER BY total DESC 
            LIMIT 1
        ");
        $stmt->execute([$my_id]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($record) {
            jsonResponse([
                'status' => 'success',
                'total' => (int)$record['total'],
                'date' => $record['date']
            ]);
        } else {
            jsonResponse(['status' => 'empty', 'total' => 0]);
        }
    }
    
    // Procure o final das ações no api.php e adicione:
elseif ($action === 'remove_friend') {
    $friend_id = $input['friend_id'] ?? null;

    if (!$friend_id) {
        jsonResponse(['error' => 'id do amigo não fornecido'], 400);
    }

    // O SQL correto para remover uma amizade aceita (remove o par independente de quem enviou)
    $stmt = $pdo->prepare("DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)");
    
    if ($stmt->execute([$my_id, $friend_id, $friend_id, $my_id])) {
        jsonResponse(['status' => 'success']);
    }
    jsonResponse(['error' => 'Erro ao remover do banco de dados'], 500);
}

    elseif ($action === 'add_water') {
        $amount = $input['amount'];
        $date = $input['date'];
        
        $stmt = $pdo->prepare("INSERT INTO consumption (user_id, amount_ml, date, time) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$my_id, $amount, $date]);
        
        jsonResponse(['status' => 'success']);
    }
    
    elseif ($action === 'delete_water') {
        $id = $input['id'] ?? null;
        
        if ($id) {
            // Usa 'consumption' pois vi no seu 'add_water' que é esse o nome da tabela
            $stmt = $pdo->prepare("DELETE FROM consumption WHERE id = ? AND user_id = ?");
            
            // Passamos $my_id também para garantir que ninguém exclua água de outro usuário
            if ($stmt->execute([$id, $my_id])) {
                jsonResponse(['status' => 'success']);
            }
        }
        jsonResponse(['status' => 'error', 'message' => 'Erro ao excluir'], 500);
    }
    
    elseif ($action === 'set_theme') {
        $theme_index = $input['theme_index'];
        $stmt = $pdo->prepare("UPDATE users SET theme_index = ? WHERE id = ?");
        $stmt->execute([$theme_index, $my_id]);
        jsonResponse(['status' => 'success']);
    }
    
    elseif ($action === 'update_water_time') {
        $record_id = $input['id'];
        $new_time = $input['time']; // Formato HH:MM
        
        // Validação simples de segurança: Garante que o registo pertence ao usuário logado
        $stmt = $pdo->prepare("UPDATE consumption SET time = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$new_time, $record_id, $my_id]);
        
        jsonResponse(['status' => 'success']);
    }
    
    elseif ($action === 'report_bug') {
        // Recebe o texto
        $message = $_POST['message'] ?? '';
        $image_path = null;

        // Processa a Imagem (se houver)
        if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = 'uploads/';
            
            // Garante nome único para não sobrescrever
            $extension = pathinfo($_FILES['screenshot']['name'], PATHINFO_EXTENSION);
            $newFileName = uniqid('bug_', true) . '.' . $extension;
            $targetFile = $uploadDir . $newFileName;

            // Validação básica (apenas imagens)
            $allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (in_array(strtolower($extension), $allowedTypes)) {
                if (move_uploaded_file($_FILES['screenshot']['tmp_name'], $targetFile)) {
                    $image_path = $targetFile;
                }
            }
        }

        // Salva no Banco
        $stmt = $pdo->prepare("INSERT INTO feedback (user_id, message, image_path) VALUES (?, ?, ?)");
        $stmt->execute([$my_id, $message, $image_path]);

        jsonResponse(['status' => 'success']);
    }

    // === ÁREA SOCIAL ===

    elseif ($action === 'search_friend') {
        // Busca nome para confirmar antes de enviar convite
        $target_phone = preg_replace('/\D/', '', $_GET['phone']);
        
        if ($target_phone == '') jsonResponse(['error' => 'Digite um número'], 400);

        // Verifica se é ele mesmo
        $stmt = $pdo->prepare("SELECT phone FROM users WHERE id = ?");
        $stmt->execute([$my_id]);
        $my_phone = $stmt->fetchColumn();
        
        if ($target_phone === $my_phone) jsonResponse(['error' => 'Você não pode se adicionar.'], 400);

        $stmt = $pdo->prepare("SELECT id, name FROM users WHERE phone = ?");
        $stmt->execute([$target_phone]);
        $friend = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($friend) {
            // Verifica status atual da amizade
            $stmt = $pdo->prepare("SELECT status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)");
            $stmt->execute([$my_id, $friend['id'], $friend['id'], $my_id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                if ($existing['status'] === 'accepted') jsonResponse(['found' => true, 'name' => $friend['name'], 'status' => 'already_friends']);
                if ($existing['status'] === 'pending') jsonResponse(['found' => true, 'name' => $friend['name'], 'status' => 'pending']);
            } else {
                jsonResponse(['found' => true, 'name' => $friend['name'], 'status' => 'can_add', 'id' => $friend['id']]);
            }
        } else {
            jsonResponse(['found' => false]);
        }
    }

    elseif ($action === 'send_invite') {
        $target_id = $input['target_id'];
        
        $stmt = $pdo->prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')");
        if ($stmt->execute([$my_id, $target_id])) {
            jsonResponse(['status' => 'success']);
        }
        jsonResponse(['error' => 'Erro ao enviar'], 500);
    }

    elseif ($action === 'get_notifications') {
        // Quem me adicionou?
        $stmt = $pdo->prepare("
            SELECT f.id, u.name 
            FROM friendships f 
            JOIN users u ON f.requester_id = u.id 
            WHERE f.addressee_id = ? AND f.status = 'pending'
        ");
        $stmt->execute([$my_id]);
        $invites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(['invites' => $invites]);
    }

    elseif ($action === 'respond_invite') {
        $invite_id = $input['invite_id'];
        $response = $input['response']; // 'accept' ou 'reject'

        if ($response === 'accept') {
            $stmt = $pdo->prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND addressee_id = ?");
            $stmt->execute([$invite_id, $my_id]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM friendships WHERE id = ? AND addressee_id = ?");
            $stmt->execute([$invite_id, $my_id]);
        }
        jsonResponse(['status' => 'success']);
    }

    elseif ($action === 'get_friends_dashboard') {
    $date = $_GET['date'] ?? date('Y-m-d');

    // Busca IDs dos amigos aceitos
    $stmt = $pdo->prepare("
        SELECT 
            CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as friend_id
        FROM friendships 
        WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
    ");
    $stmt->execute([$my_id, $my_id, $my_id]);
    $friend_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $friendsData = [];

    if (!empty($friend_ids)) {
        foreach ($friend_ids as $fid) {
            // Dados básicos do amigo
            $stmt = $pdo->prepare("SELECT name, daily_goal_ml AS goal, theme_index FROM users WHERE id = ?");
            $stmt->execute([$fid]);
            $fUser = $stmt->fetch(PDO::FETCH_ASSOC);

            // Consumo hoje
            $stmt = $pdo->prepare("SELECT SUM(amount_ml) as total FROM consumption WHERE user_id = ? AND date = ?");
            $stmt->execute([$fid, $date]);
            $fTotal = (int)($stmt->fetchColumn() ?? 0);

            // === CÁLCULO DO STREAK DO AMIGO (mesma lógica do usuário logado) ===
            $stmt = $pdo->prepare("
                SELECT date, SUM(amount_ml) as total 
                FROM consumption 
                WHERE user_id = ? 
                GROUP BY date 
                ORDER BY date DESC 
                LIMIT 365
            ");
            $stmt->execute([$fid]);
            $daily_logs = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // Histórico de metas do amigo (se existir a tabela goal_history)
            $goals_history = [];
            try {
                $stmt = $pdo->prepare("SELECT goal_ml, date_set FROM goal_history WHERE user_id = ? ORDER BY date_set DESC");
                $stmt->execute([$fid]);
                $goals_history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                // Tabela não existe ou erro → usa a meta atual como fallback
            }

            $getGoalForDate = function($target_date_str) use ($goals_history, $fUser) {
                foreach ($goals_history as $record) {
                    if ($record['date_set'] <= $target_date_str) {
                        return $record['goal_ml'];
                    }
                }
                return $fUser['goal'] ?? 2500; // fallback
            };

            $streak = 0;
            $check_date = new DateTime();

            // Verifica hoje
            $today_str = $check_date->format('Y-m-d');
            $goal_today = $getGoalForDate($today_str);
            $amount_today = $daily_logs[$today_str] ?? 0;
            if ($amount_today >= $goal_today) {
                $streak++;
            }

            // Verifica dias anteriores
            $check_date->modify('-1 day');
            while (true) {
                $date_str = $check_date->format('Y-m-d');
                $goal_that_day = $getGoalForDate($date_str);
                $amount_that_day = $daily_logs[$date_str] ?? 0;

                if ($amount_that_day >= $goal_that_day) {
                    $streak++;
                    $check_date->modify('-1 day');
                } else {
                    break;
                }
                if ($streak > 730) break; // segurança
            }
            // === FIM DO CÁLCULO DO STREAK ===

            $friendsData[] = [
                'id' => $fid,
                'name' => $fUser['name'],
                'goal' => $fUser['goal'],
                'theme_index' => $fUser['theme_index'],
                'total' => $fTotal,
                'streak' => $streak  // Agora com o valor real!
            ];
        }
    }
    jsonResponse($friendsData);
}

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>