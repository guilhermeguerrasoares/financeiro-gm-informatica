-- Remove a sobrecarga de 8 argumentos criada em 0011 como ponte para a janela
-- entre a migração e o deploy. O código novo (commit 1569d46) já está em
-- produção e sempre chama a versão de 9 argumentos, então ninguém mais passa
-- por aqui.
--
-- Motivo de não deixar parada: a ponte escolhia a conta sozinha, pegando a
-- primeira conta ativa em ordem alfabética. Com uma conta só cadastrada era a
-- única resposta possível; no momento em que existir uma segunda conta, esse
-- caminho colocaria dinheiro numa conta arbitrária sem ninguém perceber.
drop function if exists registrar_pagamento_com_permuta(uuid, date, numeric, numeric, forma_pagamento, text, text, numeric);
