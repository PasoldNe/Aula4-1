const { Pool } = require('pg');
require('dotenv').config();

// Configuração
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

function validarCliente(nome, email) {
  const erros = [];

  if (!nome || nome.trim() === '') {
    erros.push('Nome é obrigatório');
  } else if (nome.length < 3) {
    erros.push('Nome deve ter pelo menos 3 caracteres');
  }

  if (!email || email.trim() === '') {
    erros.push('Email é obrigatório');
  } else if (!email.includes('@')) {
    erros.push('Email inválido');
  }

  return erros;
}

function validarProduto(nome, preco) {
  const erros = [];

  if (!nome || nome.trim() === '') {
    erros.push('Nome é obrigatório');
  }

  if (!preco || preco <= 0) {
    erros.push('Preço deve ser maior que zero');
  }

  return erros;
}

// ============================================
// FUNÇÕES DE CLIENTE
// ============================================

async function adicionarCliente(nome, email, telefone = '') {
  const client = await pool.connect();
  try {
    const erros = validarCliente(nome, email);
    if (erros.length > 0) {
      console.error('❌ Erros de validação:');
      erros.forEach(e => console.error(`  - ${e}`));
      return false;
    }

    const resultado = await client.query(
      'INSERT INTO clientes (nome, email, telefone) VALUES ($1, $2, $3) RETURNING id',
      [nome, email, telefone]
    );

    console.log(`✅ Cliente "${nome}" adicionado com sucesso! (ID: ${resultado.rows[0].id})`);
    return true;

  } catch (erro) {
    if (erro.message.includes('duplicate key')) {
      console.error('❌ Email já cadastrado');
    } else {
      console.error('❌ Erro:', erro.message);
    }
    return false;
  } finally {
    client.release();
  }
}

async function listarClientes() {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      'SELECT id, nome, email, telefone FROM clientes ORDER BY nome'
    );

    console.log('\n📋 CLIENTES CADASTRADOS');
    console.log('='.repeat(80));

    if (resultado.rows.length === 0) {
      console.log('Nenhum cliente cadastrado');
    } else {
      resultado.rows.forEach(cliente => {
        console.log(`[${cliente.id}] ${cliente.nome} | ${cliente.email} | ${cliente.telefone || '-'}`);
      });
      console.log(`\nTotal: ${resultado.rows.length} cliente(s)`);
    }

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    client.release();
  }
}

// ============================================
// FUNÇÕES DE PRODUTO
// ============================================

async function adicionarProduto(nome, preco, estoque = 0) {
  const client = await pool.connect();
  try {
    const erros = validarProduto(nome, preco);
    if (erros.length > 0) {
      console.error('❌ Erros de validação:');
      erros.forEach(e => console.error(`  - ${e}`));
      return false;
    }

    const resultado = await client.query(
      'INSERT INTO produtos (nome, preco, estoque) VALUES ($1, $2, $3) RETURNING id',
      [nome, preco, estoque]
    );

    console.log(`✅ Produto "${nome}" adicionado com sucesso! (ID: ${resultado.rows[0].id})`);
    return true;

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
    return false;
  } finally {
    client.release();
  }
}

async function listarProdutos() {
  const client = await pool.connect();
  try {
    const resultado = await client.query(
      'SELECT id, nome, preco, estoque FROM produtos ORDER BY nome'
    );

    console.log('\n📦 PRODUTOS CADASTRADOS');
    console.log('='.repeat(80));

    if (resultado.rows.length === 0) {
      console.log('Nenhum produto cadastrado');
    } else {
      let totalValor = 0;

      resultado.rows.forEach(produto => {
        const valor = produto.preco * produto.estoque;
        totalValor += valor;
        console.log(`[${produto.id}] ${produto.nome} | R$ ${produto.preco.toFixed(2)} | Estoque: ${produto.estoque}`);
      });

      console.log(`\nTotal: ${resultado.rows.length} produto(s)`);
      console.log(`Valor total em estoque: R$ ${totalValor.toFixed(2)}`);
    }

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    client.release();
  }
}

// ============================================
// DESAFIOS EXTRAS
// ============================================

async function criarPedido(clienteId, produtoIds) {
  const client = await pool.connect();
  try {
    // Verificar se cliente existe
    const clienteResult = await client.query('SELECT id FROM clientes WHERE id = $1', [clienteId]);
    if (clienteResult.rows.length === 0) {
      console.error('❌ Cliente não encontrado');
      return false;
    }

    // Verificar produtos e calcular total
    let valorTotal = 0;
    for (const produtoId of produtoIds) {
      const produtoResult = await client.query('SELECT preco FROM produtos WHERE id = $1', [produtoId]);
      if (produtoResult.rows.length === 0) {
        console.error(`❌ Produto ID ${produtoId} não encontrado`);
        return false;
      }
      valorTotal += produtoResult.rows[0].preco;
    }

    // Inserir pedido
    const pedidoResult = await client.query(
      'INSERT INTO pedidos (cliente_id, valor_total) VALUES ($1, $2) RETURNING id',
      [clienteId, valorTotal]
    );

    console.log(`✅ Pedido criado com sucesso! (ID: ${pedidoResult.rows[0].id}, Valor: R$ ${valorTotal.toFixed(2)})`);
    return true;

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
    return false;
  } finally {
    client.release();
  }
}

async function atualizarEstoque(produtoId, novaQuantidade) {
  const client = await pool.connect();
  try {
    if (novaQuantidade < 0) {
      console.error('❌ Quantidade não pode ser negativa');
      return false;
    }

    const resultado = await client.query(
      'UPDATE produtos SET estoque = $1 WHERE id = $2 RETURNING nome, estoque',
      [novaQuantidade, produtoId]
    );

    if (resultado.rows.length === 0) {
      console.error('❌ Produto não encontrado');
      return false;
    }

    console.log(`✅ Estoque do produto "${resultado.rows[0].nome}" atualizado para ${resultado.rows[0].estoque}`);
    return true;

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
    return false;
  } finally {
    client.release();
  }
}

async function buscarCliente(termo) {
  const client = await pool.connect();
  try {
    if (!termo || termo.trim() === '') {
      console.error('❌ Termo de busca é obrigatório');
      return;
    }

    const resultado = await client.query(
      'SELECT id, nome, email, telefone FROM clientes WHERE nome ILIKE $1 OR email ILIKE $1 ORDER BY nome',
      [`%${termo}%`]
    );

    console.log(`\n🔍 RESULTADOS DA BUSCA POR "${termo}"`);
    console.log('='.repeat(80));

    if (resultado.rows.length === 0) {
      console.log('Nenhum cliente encontrado');
    } else {
      resultado.rows.forEach(cliente => {
        console.log(`[${cliente.id}] ${cliente.nome} | ${cliente.email} | ${cliente.telefone || '-'}`);
      });
      console.log(`\nEncontrados: ${resultado.rows.length} cliente(s)`);
    }

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    client.release();
  }
}

async function relatorioVendas() {
  const client = await pool.connect();
  try {
    const resultado = await client.query(`
      SELECT c.nome, COUNT(p.id) as total_pedidos, SUM(p.valor_total) as valor_total
      FROM clientes c
      LEFT JOIN pedidos p ON c.id = p.cliente_id
      GROUP BY c.id, c.nome
      ORDER BY valor_total DESC
    `);

    console.log('\n📊 RELATÓRIO DE VENDAS POR CLIENTE');
    console.log('='.repeat(80));

    if (resultado.rows.length === 0) {
      console.log('Nenhum dado encontrado');
    } else {
      resultado.rows.forEach(row => {
        console.log(`${row.nome}: ${row.total_pedidos} pedido(s) | Total: R$ ${(row.valor_total || 0).toFixed(2)}`);
      });
    }

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    client.release();
  }
}

async function excluirCliente(clienteId) {
  const client = await pool.connect();
  try {
    // Verificar se cliente existe
    const clienteResult = await client.query('SELECT nome FROM clientes WHERE id = $1', [clienteId]);
    if (clienteResult.rows.length === 0) {
      console.error('❌ Cliente não encontrado');
      return false;
    }

    // Verificar se tem pedidos
    const pedidosResult = await client.query('SELECT COUNT(*) as total FROM pedidos WHERE cliente_id = $1', [clienteId]);
    if (pedidosResult.rows[0].total > 0) {
      console.error(`❌ Cliente "${clienteResult.rows[0].nome}" possui pedidos e não pode ser excluído`);
      return false;
    }

    // Excluir cliente
    await client.query('DELETE FROM clientes WHERE id = $1', [clienteId]);
    console.log(`✅ Cliente "${clienteResult.rows[0].nome}" excluído com sucesso!`);
    return true;

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
    return false;
  } finally {
    client.release();
  }
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

async function main() {
  console.log('🏪 SISTEMA DE GERENCIAMENTO DE LOJA\n');

  // Adicionar clientes
  console.log('--- Adicionando Clientes ---');
  await adicionarCliente('Déric Martins', 'martins@email.com', '11999999999');
  await adicionarCliente('Maria Santos', 'maria@email.com', '11988888888');
  await adicionarCliente('Pedro Oliveira', 'pedro@email.com', '11977777777');

  // Listar clientes
  await listarClientes();

  // Adicionar produtos
  console.log('\n--- Adicionando Produtos ---');
  await adicionarProduto('Notebook Dell', 3500.00, 5);
  await adicionarProduto('Mouse Logitech', 80.00, 25);
  await adicionarProduto('Teclado Mecânico', 350.00, 10);
  await adicionarProduto('Monitor LG 24"', 800.00, 8);

  // Listar produtos
  await listarProdutos();

  console.log('\n✅ Operações concluídas!');
}

// Executar
main();
