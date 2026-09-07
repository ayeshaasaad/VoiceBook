const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'ledger.json');

// --- storage helpers -------------------------------------------------
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readCustomers() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeCustomers(customers) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(customers, null, 2), 'utf8');
}

function findCustomerByName(customers, name) {
  const norm = name.trim().toLowerCase();
  return customers.find(c => c.name.trim().toLowerCase() === norm);
}

// --- middleware --------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ----------------------------------------------------------------

// List all customers
app.get('/api/customers', (req, res) => {
  const customers = readCustomers();
  res.json(customers);
});

// Add a transaction (creates customer if new). Body: { name, amount, type }
// type is 'advance' or 'qarza'
app.post('/api/transactions', (req, res) => {
  const { name, amount, type } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Naam zaroori hai.' });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Sahi raqam do.' });
  }
  if (type !== 'advance' && type !== 'qarza') {
    return res.status(400).json({ error: 'Type advance ya qarza hona chahiye.' });
  }

  const customers = readCustomers();
  let customer = findCustomerByName(customers, name);

  if (!customer) {
    customer = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      advanceTotal: 0,
      qarzaTotal: 0,
      transactions: []
    };
    customers.unshift(customer);
  }

  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    amount: amt,
    ts: Date.now()
  };
  customer.transactions.unshift(tx);

  if (type === 'advance') customer.advanceTotal += amt;
  else customer.qarzaTotal += amt;

  writeCustomers(customers);
  res.json(customer);
});

// Delete a single transaction and recompute totals
app.delete('/api/customers/:customerId/transactions/:txId', (req, res) => {
  const { customerId, txId } = req.params;
  const customers = readCustomers();
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return res.status(404).json({ error: 'Customer nahi mila.' });

  const tx = customer.transactions.find(t => t.id === txId);
  if (!tx) return res.status(404).json({ error: 'Transaction nahi mila.' });

  customer.transactions = customer.transactions.filter(t => t.id !== txId);
  if (tx.type === 'advance') customer.advanceTotal -= tx.amount;
  else customer.qarzaTotal -= tx.amount;

  writeCustomers(customers);
  res.json(customer);
});

// Delete an entire customer
app.delete('/api/customers/:customerId', (req, res) => {
  let customers = readCustomers();
  const before = customers.length;
  customers = customers.filter(c => c.id !== req.params.customerId);
  if (customers.length === before) return res.status(404).json({ error: 'Customer nahi mila.' });
  writeCustomers(customers);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Voicebook chal raha hai: http://localhost:${PORT}`);
  console.log('Isi WiFi par doosre logon ke liye, apna local IP address istemal karo, e.g. http://192.168.x.x:' + PORT);
});
